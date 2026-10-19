/**
 * Invest / Redeem end to end: the API prepares the transaction, the connected
 * wallet approves (invest only), signs and broadcasts it, and the operation is
 * submitted, awaited on-chain and confirmed server-side. The app never moves
 * funds itself.
 */
import { router } from 'expo-router';
import React, { useEffect, useRef, useState } from 'react';
import { AppState, Pressable, StyleSheet, Text, View } from 'react-native';
import { encodeFunctionData, erc20Abi, parseUnits, type Hex } from 'viem';

import * as api from '../lib/api';
import {
  blockNumber,
  chainName,
  erc20Allowance,
  erc20BalanceOf,
  estimateNetworkFee,
  explorerTxUrl,
  findVaultTx,
  nativeSymbol,
  pollUntil,
  waitForReceipt,
} from '../lib/chain';
import { compare, fromRaw, isDecimal, isPositive } from '../lib/decimal';
import {
  formatBps,
  formatDecimal,
  formatRaw,
  shortAddress,
} from '../lib/format';
import type { Dtf, Operation, TradePreview, TxDraft } from '../lib/types';
import { useWallet } from '../lib/wallet';
import { colors, fonts, space, type } from '../theme/tokens';
import { openWalletApp } from '../wallets/externalWallet';
import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  Field,
  Label,
  LinkText,
  Row,
  Segmented,
} from './ui';
import { TradeProgress, type ProgressStep } from './trade/TradeProgress';
import { useLoad } from '../hooks/useLoad';
import { useUser } from '../hooks/useUser';

type Side = TradePreview['side'];

const SIDES = [
  { value: 'invest', label: 'Invest' },
  { value: 'redeem', label: 'Redeem' },
] as const;

type Step =
  'idle' | 'approving' | 'signing' | 'broadcast' | 'confirming' | 'done';

/** How long to wait for a signature, from the wallet or seen on-chain. */
const WALLET_TIMEOUT_MS = 5 * 60_000;

/**
 * While a signature is pending, ask whether the user is still on it once they
 * are back in Zeno, or after this long if the wallet never took them away.
 */
const WALLET_PROMPT_AFTER_MS = 15_000;

/** The user stopped waiting for a wallet request (Cancel). */
class WalletWaitCancelled extends Error {
  constructor() {
    super(
      'Cancelled. If you already signed in your wallet, check its activity before trying again so you don’t pay twice.',
    );
  }
}

/** Where each step sits in the checklist (broadcast is part of signing). */
const STEP_RANK: Record<Step, number> = {
  idle: -1,
  approving: 0,
  signing: 1,
  broadcast: 1,
  confirming: 2,
  done: 3,
};

export function TradePanel({
  dtf,
  baseSymbol,
  initialSide = 'invest',
  disabledReason,
  notice,
  priceStale,
  onConfirmed,
}: {
  dtf: Dtf;
  baseSymbol: string;
  initialSide?: Side;
  /** Set when the basket can't be traded at all (e.g. coming soon). */
  disabledReason?: string;
  /** Shown above the form, e.g. eligibility or wallet still needed. */
  notice?: string;
  /** The basket's price feed is stale, so quotes may be off. */
  priceStale?: boolean;
  /** Reload detail/portfolio data after a confirmed operation. */
  onConfirmed?: () => void;
}) {
  const user = useUser();
  const { address, isExternal, sendTransaction } = useWallet();
  const walletNeeded = isExternal
    ? 'Connect the wallet you signed in with (Profile → Wallets) to trade.'
    : 'Your wallet is still being set up. Try again in a moment.';

  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [operation, setOperation] = useState<Operation>();
  // A wallet request is pending; `walletPrompt` shows Open wallet / Cancel.
  const pendingWallet = useRef<{ cancel: () => void } | null>(null);
  const [awaitingWallet, setAwaitingWallet] = useState(false);
  const [walletPrompt, setWalletPrompt] = useState(false);
  /** Redeem only: which of its several transactions is being signed. */
  const [leg, setLeg] = useState(0);
  const [details, setDetails] = useState(false);
  /** Bumped after a trade so the balance re-reads. */
  const [balanceVersion, setBalanceVersion] = useState(0);
  // A preview (or its error) is only valid for the inputs it was made from,
  // so it is kept with them and hidden as soon as either input changes.
  const [result, setResult] = useState<{
    inputs: string;
    preview?: TradePreview;
    error?: string;
  }>();
  const inputs = `${side}|${amount}`;
  const current = result?.inputs === inputs ? result : undefined;
  const preview = current?.preview;
  const error = current?.error;

  const unit = side === 'invest' ? baseSymbol : dtf.symbol;
  const valid = isDecimal(amount) && isPositive(amount);
  const belowMinimum =
    side === 'invest' &&
    valid &&
    Boolean(dtf.minInvestment) &&
    compare(amount, dtf.minInvestment!) < 0;

  /** The wallet that must sign: the embedded wallet, if it is the account's. */
  const signer = address?.toLowerCase();
  const linked = user.wallets.some(w => w.address.toLowerCase() === signer);

  // What the user can spend: base asset to invest, shares to redeem.
  const balanceToken =
    side === 'invest' ? dtf.baseAssetId : dtf.contractAddress;
  const balanceDecimals =
    side === 'invest' ? dtf.baseAssetDecimals : dtf.shareDecimals;
  const { data: balanceRaw } = useLoad(
    async () =>
      signer && linked && balanceToken
        ? (await erc20BalanceOf(dtf.chainId, balanceToken, signer)).toString()
        : null,
    `${side}#${signer ?? 'none'}#${linked}#${balanceVersion}`,
  );
  const balance = balanceRaw ? fromRaw(balanceRaw, balanceDecimals) : null;
  const overBalance = valid && balance !== null && compare(amount, balance) > 0;

  const gas = preview?.draft.transaction.gas;
  const feeChainId = preview?.draft.transaction.chainId ?? dtf.chainId;
  const { data: feeWei } = useLoad(
    async () =>
      gas
        ? (await estimateNetworkFee(feeChainId, BigInt(gas))).toString()
        : null,
    `fee#${preview?.draft.requestId ?? 'none'}`,
  );

  const review = async () => {
    if (!signer || !linked) {
      setResult({
        inputs,
        error: walletNeeded,
      });
      return;
    }
    setBusy(true);
    setOperation(undefined);
    try {
      setResult({
        inputs,
        preview: await api.previewTrade(dtf, side, amount, signer),
      });
    } catch (e) {
      setResult({
        inputs,
        error: e instanceof Error ? e.message : 'Could not prepare a preview.',
      });
    } finally {
      setBusy(false);
    }
  };

  /**
   * Waits for a wallet request (and its on-chain watch) unless the user taps
   * Cancel first. Cancel stops waiting here only: a request already in the
   * wallet stays there, hence the "check before trying again" message.
   */
  function untilWalletAnswers<T>(work: Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const pending = {
        cancel: () => {
          finish();
          reject(new WalletWaitCancelled());
        },
      };
      const finish = () => {
        if (pendingWallet.current !== pending) return;
        pendingWallet.current = null;
        setAwaitingWallet(false);
        setWalletPrompt(false);
      };
      pendingWallet.current = pending;
      setAwaitingWallet(true);
      work.then(
        value => {
          finish();
          resolve(value);
        },
        e => {
          finish();
          reject(e);
        },
      );
    });
  }

  // Coming back to Zeno (or a long wait) without an answer: offer a way out
  // instead of an endless spinner.
  useEffect(() => {
    if (!awaitingWallet) return;
    let wasAway = AppState.currentState !== 'active';
    const timer = setTimeout(
      () => setWalletPrompt(true),
      WALLET_PROMPT_AFTER_MS,
    );
    const sub = AppState.addEventListener('change', state => {
      if (state !== 'active') wasAway = true;
      else if (wasAway) setWalletPrompt(true);
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, [awaitingWallet]);

  /**
   * The invest draft calls the vault's `deposit`, which pulls USDG via
   * transferFrom — so the vault needs an ERC-20 allowance first.
   *
   * The allowance is also watched on-chain: the wallet's reply can be lost
   * while Zeno is in the background, even though the approval went through.
   */
  async function approveSpend(spender: string, amountRaw: bigint) {
    const allowance = () =>
      erc20Allowance(dtf.chainId, dtf.baseAssetId, signer!, spender);
    if ((await allowance()) >= amountRaw) return;
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender as Hex, amountRaw],
    });
    const watch = new AbortController();
    try {
      await untilWalletAnswers(
        Promise.race([
          sendTransaction({
            chainId: dtf.chainId,
            to: dtf.baseAssetId as Hex,
            data,
          }).then(async txHash => {
            const receipt = await waitForReceipt(dtf.chainId, txHash);
            if (receipt.status !== 'success') {
              throw new Error(
                'The spend approval transaction failed on-chain.',
              );
            }
          }),
          pollUntil(
            async () => ((await allowance()) >= amountRaw ? true : null),
            {
              signal: watch.signal,
              timeoutMs: WALLET_TIMEOUT_MS,
              timeout: 'No answer from your wallet for the spend approval.',
            },
          ),
        ]),
      );
    } finally {
      watch.abort();
    }
  }

  /** Signs, broadcasts and settles one prepared transaction. */
  async function sendDraft(draft: TxDraft) {
    const chainId = draft.transaction.chainId;
    const to = draft.transaction.to;
    setLeg(n => n + 1);
    setStep('signing');
    // Watched on-chain as well as answered by the wallet, so a lost reply
    // can't leave the app waiting on a transaction that already landed (and
    // tempt a second, duplicate deposit).
    const fromBlock = await blockNumber(chainId);
    const watch = new AbortController();
    let txHash: string;
    try {
      txHash = await untilWalletAnswers(
        Promise.race([
          sendTransaction({
            chainId,
            to: to as Hex,
            data: draft.transaction.data,
            value: BigInt(draft.transaction.value || '0'),
            ...(draft.transaction.gas
              ? { gas: BigInt(draft.transaction.gas) }
              : {}),
          }),
          pollUntil(
            () =>
              findVaultTx(
                chainId,
                to,
                signer!,
                fromBlock,
                draft.transaction.data,
              ),
            {
              signal: watch.signal,
              timeoutMs: WALLET_TIMEOUT_MS,
              timeout:
                'No answer from your wallet. If you signed, check your wallet’s activity before trying again so you don’t pay twice.',
            },
          ),
        ]),
      );
    } finally {
      watch.abort();
    }

    setStep('broadcast');
    setOperation(await api.submitOperation(draft.requestId, txHash));

    setStep('confirming');
    const receipt = await waitForReceipt(chainId, txHash);
    const final =
      receipt.status === 'success'
        ? await api.confirmOperation(draft.requestId, txHash)
        : await api.failOperation(
            draft.requestId,
            txHash,
            'transaction reverted',
          );
    setOperation(final);
    if (receipt.status !== 'success') {
      throw new Error('The transaction reverted on-chain.');
    }
  }

  const confirmTrade = async () => {
    if (!preview || !signer) return;
    let draft = preview.draft;
    setBusy(true);
    setOperation(undefined);
    setLeg(0);
    try {
      setStep('signing');

      if (side === 'invest') {
        setStep('approving');
        await approveSpend(
          draft.transaction.to,
          parseUnits(amount, dtf.baseAssetDecimals),
        );
      }

      await sendDraft(draft);
      // Selling is several transactions (request → swap per asset → claim);
      // the API hands out the next one until the last step is done.
      while (side === 'redeem' && draft.finalStep === false) {
        setStep('signing');
        draft = await api.prepareTrade(dtf, 'redeem', {
          amount,
          recipient: signer,
        });
        await sendDraft(draft);
      }
      setStep('done');
      setBalanceVersion(v => v + 1);
      onConfirmed?.();
    } catch (e) {
      setOperation(undefined);
      setResult({
        inputs,
        error: e instanceof Error ? e.message : 'Transaction failed.',
      });
      setStep('idle');
    } finally {
      setBusy(false);
    }
  };

  const txUrl =
    operation?.txHash && operation.txHash.length > 10
      ? explorerTxUrl(dtf.chainId, operation.txHash)
      : null;
  const inFlow = busy && step !== 'idle';
  const progress: ProgressStep[] = [
    ...(side === 'invest'
      ? [{ key: 'approving' as const, label: `Approve ${baseSymbol} spend` }]
      : []),
    {
      key: 'signing' as const,
      label:
        side === 'redeem' && leg > 1
          ? `Sign transaction ${leg}`
          : 'Sign in your wallet',
    },
    { key: 'confirming' as const, label: 'Confirm on-chain' },
  ].map(({ key, label }) => ({
    key,
    label,
    state:
      STEP_RANK[step] > STEP_RANK[key]
        ? 'done'
        : STEP_RANK[step] === STEP_RANK[key]
          ? 'now'
          : 'todo',
    hint:
      key === 'confirming'
        ? 'Usually under a minute.'
        : 'Open your wallet if it didn’t come up, then come back here.',
  }));

  const newTrade = () => {
    setAmount('');
    setOperation(undefined);
    setStep('idle');
  };

  return (
    <Card title="Invest or redeem" banded>
      {disabledReason ? (
        <Body muted>{disabledReason}</Body>
      ) : (
        <>
          <Segmented options={SIDES} value={side} onChange={setSide} />
          {notice ? <Badge label={notice} tone="gold" /> : null}
          {priceStale ? (
            <Badge
              label="Price may be out of date — amounts can differ"
              tone="danger"
            />
          ) : null}
          {!linked ? <Body muted>{walletNeeded}</Body> : null}
          <Field
            label={
              side === 'invest'
                ? `You pay (${baseSymbol})`
                : `Shares to redeem (${dtf.symbol})`
            }
            value={amount}
            onChangeText={text =>
              setAmount(text.replace(',', '.').replace(/[^\d.]/g, ''))
            }
            placeholder="0.00"
            keyboardType="decimal-pad"
          />
          {balance !== null ? (
            <View style={styles.line}>
              <Text
                style={[
                  type.small,
                  { color: overBalance ? colors.danger : colors.muted },
                ]}
              >
                Available {formatDecimal(balance, 4)} {unit}
              </Text>
              <Pressable
                onPress={() => setAmount(balance)}
                accessibilityRole="button"
                accessibilityLabel={`Use the full ${unit} balance`}
                hitSlop={8}
              >
                <Text style={styles.max}>MAX</Text>
              </Pressable>
            </View>
          ) : null}
          {side === 'invest' && dtf.minInvestment ? (
            <Text
              style={[
                type.small,
                { color: belowMinimum ? colors.danger : colors.muted },
              ]}
            >
              Minimum investment {formatDecimal(dtf.minInvestment)} {baseSymbol}
            </Text>
          ) : null}
          <Button
            label="Review"
            onPress={review}
            disabled={!valid || belowMinimum || overBalance || !linked}
            loading={busy && step === 'idle'}
          />
          {error ? (
            <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
          ) : null}
        </>
      )}

      {preview && !inFlow && step !== 'done' && (
        <View style={{ gap: space.sm }}>
          <Divider />
          <Label accent>Preview</Label>
          <Row
            label="You pay"
            value={`${formatDecimal(preview.pay, 4)} ${unit}`}
          />
          <Row
            label={side === 'invest' ? 'Entry fee' : 'Exit fee'}
            value={`${formatDecimal(preview.fee, 4)} (${formatBps(
              preview.feeBps,
            )})`}
          />
          <Row
            label="Quoted NAV / share"
            value={formatDecimal(preview.quotedSharePrice, 6)}
          />
          <Row
            label={side === 'invest' ? 'Expected shares' : 'You receive'}
            value={`${formatDecimal(preview.receive, 4)} ${
              side === 'invest' ? dtf.symbol : baseSymbol
            }`}
          />
          <Row
            label="Network fee"
            value={
              feeWei
                ? `≈ ${formatRaw(feeWei, 18, 6)} ${nativeSymbol(feeChainId)}`
                : '—'
            }
          />
          <Pressable
            onPress={() => setDetails(d => !d)}
            accessibilityRole="button"
            accessibilityState={{ expanded: details }}
            hitSlop={8}
          >
            <Text style={styles.toggle}>
              Transaction details {details ? '▴' : '▾'}
            </Text>
          </Pressable>
          {details ? (
            <>
              <Row
                label="To"
                value={shortAddress(preview.draft.transaction.to)}
              />
              <Row
                label="Network"
                value={chainName(preview.draft.transaction.chainId)}
                mono={false}
              />
              <Row
                label="Gas limit"
                value={preview.draft.transaction.gas ?? '—'}
              />
            </>
          ) : null}
          <Button
            label="Sign and send"
            variant="green"
            onPress={confirmTrade}
            loading={busy}
          />
          <Text style={[type.small, { color: colors.dim }]}>
            The final amounts are set by the quote when you sign. Prices can
            move before then.
          </Text>
        </View>
      )}

      {inFlow && (
        <View style={{ gap: space.md }}>
          <Divider />
          <TradeProgress steps={progress} />
        </View>
      )}

      {walletPrompt ? (
        <View style={{ gap: space.sm }} accessibilityLiveRegion="polite">
          <Label accent>Waiting for your wallet</Label>
          <Body muted>
            Approve the request in your wallet to continue, or cancel it here.
          </Body>
          {/* The embedded wallet signs in-app: nothing to open. */}
          {isExternal ? (
            <Button
              label="Open wallet"
              variant="outline"
              onPress={() => void openWalletApp()}
            />
          ) : null}
          <Button
            label="Cancel"
            variant="ghost"
            onPress={() => pendingWallet.current?.cancel()}
          />
        </View>
      ) : null}

      {step === 'done' && operation && (
        <View style={{ gap: space.sm }}>
          <Divider />
          <Badge
            label={
              operation.status === 'confirmed' ? 'Confirmed' : operation.status
            }
            tone={operation.status === 'confirmed' ? 'green' : 'gold'}
          />
          {preview ? (
            <>
              <Row
                label={side === 'invest' ? 'You paid' : 'Shares redeemed'}
                value={`${formatDecimal(preview.pay, 4)} ${unit}`}
              />
              <Row
                label={
                  side === 'invest'
                    ? 'Shares (estimated)'
                    : 'You receive (est.)'
                }
                value={`${formatDecimal(preview.receive, 4)} ${
                  side === 'invest' ? dtf.symbol : baseSymbol
                }`}
              />
            </>
          ) : null}
          {operation.txHash ? (
            <Row
              label="Transaction"
              value={
                <LinkText
                  mono
                  label={shortAddress(operation.txHash)}
                  url={txUrl}
                />
              }
            />
          ) : null}
          <Button
            label="Go to portfolio"
            variant="outline"
            onPress={() => router.navigate('/portfolio')}
          />
          <Button label="New trade" variant="ghost" onPress={newTrade} />
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  max: { fontFamily: fonts.semibold, fontSize: 12, color: colors.gold },
  toggle: { ...type.small, color: colors.gold },
});
