/**
 * One activity (design: Activity detail), opened from Portfolio → Activities.
 * What the activity row already says shows at once: basket, amount, status,
 * shares, wallet, network, tx hash. The exact NAV, fee and network fee come
 * from the transaction's receipt (lib/activity): skeletons while it's read,
 * a "Try again" if the chain can't be reached. A pending one is watched for
 * a while, only while this screen is open.
 */
import * as Clipboard from 'expo-clipboard';
import { router, useLocalSearchParams } from 'expo-router';
import React, { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ChevronLeftIcon,
  CopyIcon,
  ExternalLinkIcon,
} from '../../components/icons';
import { Empty, Notice, SkeletonBar } from '../../components/ui';
import {
  activityDetails,
  tokenSymbol,
  type ActivityDetails,
  type ActivityLink,
} from '../../lib/activity';
import { openInAppBrowser } from '../../lib/browser';
import { chainName, explorerTxUrl, nativeSymbol } from '../../lib/chain';
import { compare, div, fromRaw, ratioBps } from '../../lib/decimal';
import {
  formatBps,
  formatDateTime,
  formatDecimal,
  formatRaw,
  humanize,
  shortAddress,
} from '../../lib/format';
import { usd } from '../../lib/money';
import { colors, fonts, radius, space } from '../../theme/tokens';

/** A pending activity is checked this often, for this long. */
const PENDING_POLL_MS = 5_000;
const PENDING_WATCH_MS = 120_000;

type Read =
  | { state: 'loading' }
  | { state: 'ready'; details: ActivityDetails }
  | { state: 'pending' }
  | { state: 'failed' };

function parseLink(data: string | undefined): ActivityLink | null {
  try {
    return data ? (JSON.parse(data) as ActivityLink) : null;
  } catch {
    return null;
  }
}

const STATUS = {
  confirmed: { label: 'Confirmed', color: colors.green },
  pending: { label: 'Pending', color: colors.gold },
  reverted: { label: 'Failed', color: colors.red },
} as const;

/** "0.000021 ETH"; a fee too small for six places still says so. */
function ethAmount(raw: string, symbol: string): string {
  const value = fromRaw(raw, 18);
  if (compare(value, '0') > 0 && compare(value, '0.000001') < 0) {
    return `< 0.000001 ${symbol}`;
  }
  return `${formatDecimal(value, 6)} ${symbol}`;
}

export default function ActivityScreen() {
  const insets = useSafeAreaInsets();
  const { data } = useLocalSearchParams<{ id: string; data?: string }>();
  const link = parseLink(data);
  const tx = link?.tx;
  const basket = link?.basket;
  const chainId = tx?.chainId || basket?.chainId || 0;

  const [attempt, setAttempt] = useState(0);
  const [read, setRead] = useState<Read>({ state: 'loading' });
  const [unit, setUnit] = useState('');
  const [copied, setCopied] = useState(false);

  // The receipt: once, or every few seconds while the activity is pending.
  useEffect(() => {
    if (!tx?.txHash || !basket || !tx.walletAddress) return;
    const wallet = tx.walletAddress;
    let live = true;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const started = Date.now();
    const check = async () => {
      try {
        const details = await activityDetails(
          chainId,
          tx.txHash,
          basket.id,
          wallet,
        );
        if (!live) return;
        if (details) setRead({ state: 'ready', details });
        else if (Date.now() - started < PENDING_WATCH_MS) {
          timer = setTimeout(check, PENDING_POLL_MS);
        } else setRead({ state: 'pending' });
      } catch {
        if (live) setRead({ state: 'failed' });
      }
    };
    void check();
    return () => {
      live = false;
      clearTimeout(timer);
    };
    // The link is fixed for this screen; `attempt` re-reads on Try again.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [attempt]);

  // "USDG" after the amount, read from the base asset's contract.
  useEffect(() => {
    if (!basket?.baseAssetId) return;
    let live = true;
    tokenSymbol(chainId, basket.baseAssetId).then(
      symbol => live && setUnit(symbol),
      () => {},
    );
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const back = () => (router.canGoBack() ? router.back() : router.replace('/'));
  const header = (
    <Pressable
      onPress={back}
      accessibilityRole="button"
      accessibilityLabel="Back to activity"
      hitSlop={12}
      style={styles.back}
    >
      <ChevronLeftIcon color={colors.muted} size={18} />
      <Text style={styles.backText}>Activity</Text>
    </Pressable>
  );

  if (!tx || !basket) {
    return (
      <View style={[styles.root, { paddingTop: insets.top + space.lg }]}>
        <View style={styles.pad}>
          {header}
          <Empty
            title="This activity isn't available"
            body="Open it again from Portfolio → Activities."
          />
        </View>
      </View>
    );
  }

  const invest = tx.action === 'invest';
  const details = read.state === 'ready' ? read.details : undefined;
  // A pending row whose transaction has since been mined shows how it ended.
  const status = details
    ? details.succeeded
      ? STATUS.confirmed
      : STATUS.reverted
    : STATUS[tx.status];
  const base = (raw: string) => usd(fromRaw(raw, basket.baseAssetDecimals));
  const shares = (raw: string | null | undefined) =>
    raw ? formatRaw(raw, basket.shareDecimals, 4) : '—';
  const url = tx.txHash ? explorerTxUrl(chainId, tx.txHash) : null;

  // Receipt values: a skeleton while read, "—" when there's nothing to show.
  const fromReceipt = (value: (d: ActivityDetails) => string | null) =>
    read.state === 'loading' && tx.txHash ? (
      <SkeletonBar width={90} height={12} round={6} />
    ) : (
      <Text style={styles.value}>{(details && value(details)) ?? '—'}</Text>
    );

  const deposit = details?.deposit;
  const request = details?.redeemRequest;
  const claim = details?.claim;

  const rows: { label: string; value: React.ReactNode }[] = invest
    ? [
        {
          label: 'Shares received',
          value: (
            <Text style={styles.value}>
              {shares(deposit?.sharesMinted ?? tx.shareAmountRaw)}
            </Text>
          ),
        },
        {
          label: 'NAV at execution',
          value: fromReceipt(d =>
            d.deposit && compare(d.deposit.sharesMinted, '0') > 0
              ? formatDecimal(
                  div(
                    fromRaw(d.deposit.netUsdc, basket.baseAssetDecimals),
                    fromRaw(d.deposit.sharesMinted, basket.shareDecimals),
                  ),
                  6,
                )
              : null,
          ),
        },
        {
          label: 'Entry fee',
          value: fromReceipt(d =>
            d.deposit
              ? `${formatDecimal(
                  fromRaw(d.deposit.fee, basket.baseAssetDecimals),
                )} (${formatBps(ratioBps(d.deposit.fee, d.deposit.usdcAmount))})`
              : null,
          ),
        },
      ]
    : [
        {
          label: 'Shares redeemed',
          value: (
            <Text style={styles.value}>
              {shares(request?.sharesBurned ?? tx.shareAmountRaw)}
            </Text>
          ),
        },
        {
          label: claim ? 'Amount received' : 'Amount credited',
          value: fromReceipt(d =>
            d.claim
              ? base(d.claim.netUsdc)
              : d.redeemRequest
                ? base(d.redeemRequest.usdcCredited)
                : null,
          ),
        },
        {
          label: 'Exit fee',
          // Charged when the redeemed USDG is claimed, not on the request.
          value: fromReceipt(d =>
            d.claim
              ? `${formatDecimal(
                  fromRaw(d.claim.fee, basket.baseAssetDecimals),
                )} (${formatBps(ratioBps(d.claim.fee, d.claim.grossUsdc))})`
              : d.redeemRequest
                ? 'On claim'
                : null,
          ),
        },
      ];
  rows.push(
    {
      label: 'Network fee',
      value: fromReceipt(d =>
        ethAmount(d.networkFeeRaw, nativeSymbol(chainId)),
      ),
    },
    {
      label: 'Wallet',
      value: (
        <Text style={styles.value}>
          {tx.walletAddress ? shortAddress(tx.walletAddress) : '—'}
        </Text>
      ),
    },
    {
      label: 'Network',
      value: <Text style={styles.value}>{chainName(chainId)}</Text>,
    },
  );

  const copyHash = async () => {
    await Clipboard.setStringAsync(tx.txHash);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: insets.bottom + space.xxl,
        }}
      >
        <View style={styles.pad}>
          {header}

          <View style={styles.titles}>
            <Text style={styles.symbol}>{basket.symbol}</Text>
            <Text style={styles.name}>{basket.name}</Text>
          </View>

          <View
            style={[styles.tag, invest ? styles.tagGreen : styles.tagNeutral]}
          >
            <Text
              style={[
                styles.tagText,
                { color: invest ? colors.green : colors.textSecondary },
              ]}
            >
              {humanize(tx.action)}
            </Text>
          </View>
          <Text style={styles.amount}>
            {tx.amountRaw ? base(tx.amountRaw) : '—'}
            {unit ? <Text style={styles.unit}> {unit}</Text> : null}
          </Text>

          <View style={styles.status}>
            <View style={styles.statusLine}>
              <Text style={styles.label}>Status</Text>
              <Text style={styles.date}>{formatDateTime(tx.occurredAt)}</Text>
            </View>
            <Text style={[styles.statusText, { color: status.color }]}>
              {status.label}
            </Text>
          </View>
        </View>

        <View>
          {rows.map(row => (
            <View key={row.label} style={styles.row}>
              <Text style={styles.label}>{row.label}</Text>
              {row.value}
            </View>
          ))}
          <View style={styles.row}>
            <Text style={styles.label}>Tx hash</Text>
            {tx.txHash ? (
              <View style={styles.hash}>
                <Text style={styles.value}>
                  {copied ? 'Copied' : shortAddress(tx.txHash)}
                </Text>
                <Pressable
                  onPress={() => void copyHash()}
                  accessibilityRole="button"
                  accessibilityLabel="Copy transaction hash"
                  hitSlop={10}
                >
                  <CopyIcon color={colors.gold} size={16} />
                </Pressable>
                {url ? (
                  <Pressable
                    onPress={() => void openInAppBrowser(url)}
                    accessibilityRole="link"
                    accessibilityLabel="Open on the explorer"
                    hitSlop={10}
                  >
                    <ExternalLinkIcon color={colors.gold} size={16} />
                  </Pressable>
                ) : null}
              </View>
            ) : (
              <Text style={styles.value}>—</Text>
            )}
          </View>
        </View>

        {read.state === 'failed' || read.state === 'pending' ? (
          <View style={[styles.pad, styles.notice]}>
            <Notice
              tone={read.state === 'failed' ? 'error' : 'warning'}
              title={
                read.state === 'failed'
                  ? 'Couldn’t load the on-chain details'
                  : 'Still pending'
              }
              message={
                read.state === 'failed'
                  ? 'The network didn’t answer in time. The rest of this activity is up to date.'
                  : 'The network hasn’t confirmed this transaction yet.'
              }
              actions={[
                {
                  label: read.state === 'failed' ? 'Try again' : 'Refresh',
                  onPress: () => {
                    setRead({ state: 'loading' });
                    setAttempt(n => n + 1);
                  },
                },
              ]}
            />
          </View>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.lg },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    alignSelf: 'flex-start',
    marginBottom: space.xl,
  },
  backText: { fontFamily: fonts.regular, fontSize: 15, color: colors.muted },
  titles: { gap: 4, marginBottom: space.lg },
  symbol: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.5,
    color: colors.gold,
  },
  name: { fontFamily: fonts.regular, fontSize: 18, color: colors.text },
  tag: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  tagGreen: {
    backgroundColor: colors.greenSoft,
    borderColor: colors.greenLine,
  },
  tagNeutral: { backgroundColor: colors.surface2, borderColor: colors.line },
  tagText: { fontFamily: fonts.regular, fontSize: 11 },
  amount: {
    fontFamily: fonts.regular,
    fontSize: 28,
    color: colors.text,
    marginTop: space.sm,
    marginBottom: space.xl,
  },
  unit: { fontSize: 13, color: colors.muted },
  status: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    padding: space.lg,
    gap: space.md,
    marginBottom: space.sm,
  },
  statusLine: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  statusText: { fontFamily: fonts.regular, fontSize: 15 },
  date: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.xl,
    paddingVertical: 18,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  value: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.text,
    flexShrink: 1,
    textAlign: 'right',
  },
  hash: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  notice: { marginTop: space.xl },
});
