/**
 * Invest / Redeem end to end: the API prepares the transaction, the connected
 * wallet approves (invest only), signs and broadcasts it, and the operation is
 * submitted, awaited on-chain and confirmed server-side. The app never moves
 * funds itself.
 */
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { encodeFunctionData, erc20Abi, parseUnits, type Hex } from 'viem';
import {
  useAccount,
  useChainId,
  useSendTransaction,
  useSwitchChain,
} from 'wagmi';

import * as api from '../lib/api';
import { erc20Allowance, waitForReceipt } from '../lib/chain';
import { compare, isDecimal, isPositive } from '../lib/decimal';
import { formatBps, formatDecimal, shortAddress } from '../lib/format';
import { useUser } from '../lib/session';
import type { Dtf, Operation, TradePreview } from '../lib/types';
import { colors, space, type } from '../theme/tokens';
import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  Field,
  Label,
  Row,
  Segmented,
} from './ui';

type Side = TradePreview['side'];

const SIDES = [
  { value: 'invest', label: 'Invest' },
  { value: 'redeem', label: 'Redeem' },
] as const;

type Step =
  'idle' | 'approving' | 'signing' | 'broadcast' | 'confirming' | 'done';

const STEP_LABEL: Record<Exclude<Step, 'idle' | 'done'>, string> = {
  approving: 'Approving spend…',
  signing: 'Confirm in your wallet…',
  broadcast: 'Broadcasting…',
  confirming: 'Confirming on-chain…',
};

export function TradePanel({
  dtf,
  baseSymbol,
  initialSide = 'invest',
  disabledReason,
  notice,
  onConfirmed,
}: {
  dtf: Dtf;
  baseSymbol: string;
  initialSide?: Side;
  /** Set when the basket can't be traded at all (e.g. coming soon). */
  disabledReason?: string;
  /** Shown above the form, e.g. eligibility or wallet still needed. */
  notice?: string;
  /** Reload detail/portfolio data after a confirmed operation. */
  onConfirmed?: () => void;
}) {
  const user = useUser();
  const { address, isConnected } = useAccount();
  const walletChainId = useChainId();
  const { sendTransactionAsync } = useSendTransaction();
  const { switchChainAsync } = useSwitchChain();

  const [side, setSide] = useState<Side>(initialSide);
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [step, setStep] = useState<Step>('idle');
  const [operation, setOperation] = useState<Operation>();
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

  /** The wallet that must sign: the connected account, if it is linked. */
  const signer = address?.toLowerCase();
  const linked = user.wallets.some(w => w.address.toLowerCase() === signer);
  const wrongChain =
    preview !== undefined &&
    walletChainId !== preview.draft.transaction.chainId;

  const review = async () => {
    if (!signer || !linked) {
      setResult({
        inputs,
        error: 'Connect and link a wallet first (Profile → Wallets).',
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

  async function ensureChain(chainId: number) {
    if (walletChainId === chainId) return;
    try {
      await switchChainAsync({ chainId });
    } catch {
      throw new Error(`Switch your wallet to chain ${chainId} and try again.`);
    }
  }

  /**
   * The invest draft calls `portfolio.invest`, which pulls the base asset via
   * transferFrom — so the portfolio contract needs an ERC-20 allowance first.
   */
  async function approveSpend(spender: string, amountRaw: bigint) {
    const allowance = await erc20Allowance(
      dtf.chainId,
      dtf.baseAssetId,
      signer!,
      spender,
    );
    if (allowance >= amountRaw) return;
    const data = encodeFunctionData({
      abi: erc20Abi,
      functionName: 'approve',
      args: [spender as Hex, amountRaw],
    });
    const txHash = await sendTransactionAsync({
      account: signer as Hex,
      chainId: dtf.chainId,
      to: dtf.baseAssetId as Hex,
      data,
      value: 0n,
    });
    const receipt = await waitForReceipt(dtf.chainId, txHash);
    if (receipt.status !== 'success') {
      throw new Error('The spend approval transaction failed on-chain.');
    }
  }

  const confirmTrade = async () => {
    if (!preview || !signer) return;
    const draft = preview.draft;
    const chainId = draft.transaction.chainId;
    setBusy(true);
    setOperation(undefined);
    try {
      setStep('signing');
      await ensureChain(chainId);

      if (side === 'invest') {
        setStep('approving');
        await approveSpend(
          draft.transaction.to,
          parseUnits(amount, dtf.baseAssetDecimals),
        );
        setStep('signing');
      }

      const txHash = await sendTransactionAsync({
        account: signer as Hex,
        chainId,
        to: draft.transaction.to as Hex,
        data: draft.transaction.data,
        value: BigInt(draft.transaction.value || '0'),
        ...(draft.transaction.gas
          ? { gas: BigInt(draft.transaction.gas) }
          : {}),
      });

      setStep('broadcast');
      const submitted = await api.submitOperation(draft.requestId, txHash);
      setOperation(submitted);

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
      setStep('done');
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

  const explorerNote =
    operation?.txHash && operation.txHash.length > 10
      ? `Tx ${shortAddress(operation.txHash)}`
      : null;

  return (
    <Card title="Invest or redeem" banded>
      {disabledReason ? (
        <Body muted>{disabledReason}</Body>
      ) : (
        <>
          <Segmented options={SIDES} value={side} onChange={setSide} />
          {notice ? <Badge label={notice} tone="gold" /> : null}
          {!isConnected || !linked ? (
            <Body muted>
              Connect and link a wallet (Profile → Wallets) to invest.
            </Body>
          ) : null}
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
            disabled={!valid || belowMinimum || !linked}
            loading={busy && step === 'idle'}
          />
          {error ? (
            <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
          ) : null}
        </>
      )}

      {preview && !operation && step !== 'done' && (
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
          <Divider />
          <Label>Transaction draft</Label>
          <Row label="To" value={shortAddress(preview.draft.transaction.to)} />
          <Row
            label="Chain"
            value={String(preview.draft.transaction.chainId)}
          />
          <Row label="Gas limit" value={preview.draft.transaction.gas ?? '—'} />
          {wrongChain ? (
            <Body muted>
              Your wallet is on chain {walletChainId}; switch to{' '}
              {preview.draft.transaction.chainId} when signing.
            </Body>
          ) : null}
          <Button
            label={
              busy
                ? (STEP_LABEL[step as keyof typeof STEP_LABEL] ?? 'Working…')
                : 'Sign and send'
            }
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

      {step === 'done' && operation && (
        <View style={{ gap: space.sm }}>
          <Divider />
          <Badge
            label={
              operation.status === 'confirmed' ? 'Confirmed' : operation.status
            }
            tone={operation.status === 'confirmed' ? 'green' : 'gold'}
          />
          {explorerNote ? (
            <Text style={[type.small, { color: colors.muted }]}>
              {explorerNote}
            </Text>
          ) : null}
        </View>
      )}
    </Card>
  );
}
