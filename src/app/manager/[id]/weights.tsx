/**
 * Manager → basket → Target weights: the basket's assets as one colour-coded
 * bar and a row each with the target typed in as a percentage. Add any
 * allowed (priced) asset, or set one to 0% to wind it down and drop it.
 * Update weights prepares setTargetAllocations (POST …/allocations/prepare),
 * signs and submits it; the trades then show up as Rebalance actions.
 * Opened with ?add=<asset> (from Assets) that asset is already listed at 0%.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { ManagerBasketScreen } from '../../../components/manager/ManagerBasketScreen';
import { alert, Button, TokenLogo } from '../../../components/ui';
import { useLoad } from '../../../hooks/useLoad';
import { useSendDraft } from '../../../hooks/useSendDraft';
import * as api from '../../../lib/api';
import { shortAddress } from '../../../lib/format';
import { colors, fonts, series, space } from '../../../theme/tokens';

type Line = {
  assetId: string;
  symbol: string;
  name: string;
  logoUrl: string | null;
  /** Target on chain now; 0 for an asset being added. */
  onChainBps: number;
  /** What the manager typed, in percent. */
  pct: string;
};

const FULL = 10_000;

async function load(id: string) {
  const [dashboard, options] = await Promise.all([
    api.getManagerDashboard(id),
    api.getCreateOptions(),
  ]);
  return { dashboard, options };
}

/** 2550 bps -> "25.5"; 3000 -> "30". */
const pctOf = (bps: number) => String(bps / 100);
/** "25.5" -> 2550; junk -> 0. */
const bpsOf = (pct: string) => Math.round((Number(pct) || 0) * 100);

function initialLines(
  data: Awaited<ReturnType<typeof load>>,
  add: string | undefined,
): Line[] {
  const known = new Map(data.options.assets.map(a => [a.id, a]));
  const lines: Line[] = data.dashboard.slots.map(s => {
    const a = known.get(s.assetId);
    return {
      assetId: s.assetId,
      symbol: s.symbol ?? a?.symbol ?? shortAddress(s.assetId),
      name: a?.name ?? '',
      logoUrl: a?.logoUrl ?? null,
      onChainBps: s.targetBps,
      pct: pctOf(s.targetBps),
    };
  });
  const extra =
    add && !lines.some(l => l.assetId === add) ? known.get(add) : undefined;
  if (extra) {
    lines.push({
      assetId: extra.id,
      symbol: extra.symbol,
      name: extra.name,
      logoUrl: extra.logoUrl,
      onChainBps: 0,
      pct: '0',
    });
  }
  return lines;
}

export default function ManagerWeightsScreen() {
  const params = useLocalSearchParams<{ id: string; add?: string }>();
  const id = params.id;
  const add = params.add?.toLowerCase();
  const sendDraft = useSendDraft();
  const { data, loading, error, reload } = useLoad(
    async () => (id ? load(id) : undefined),
    `manager-weights#${id ?? ''}`,
  );
  // Until the manager edits, the rows are the chain's current targets (plus the asset Assets asked for).
  const [edited, setEdited] = useState<Line[]>();
  const lines = useMemo(
    () => edited ?? (data ? initialLines(data, add) : []),
    [edited, data, add],
  );
  const setLines = (fn: (ls: Line[]) => Line[]) => setEdited(fn(lines));
  const [adding, setAdding] = useState(false);
  const [busy, setBusy] = useState(false);

  const dtf = data?.dashboard.dtf;
  const total = lines.reduce((sum, l) => sum + bpsOf(l.pct), 0);
  const changed = lines.some(l => bpsOf(l.pct) !== l.onChainBps);
  const candidates = (data?.options.assets ?? []).filter(
    a => a.selectable && !lines.some(l => l.assetId === a.id),
  );

  const setPct = (assetId: string, pct: string) =>
    setLines(ls =>
      ls.map(l =>
        l.assetId === assetId
          ? { ...l, pct: pct.replace(',', '.').replace(/[^\d.]/g, '') }
          : l,
      ),
    );

  /** An asset on chain winds down at 0%; one just added simply leaves the list. */
  const remove = (line: Line) =>
    line.onChainBps > 0
      ? setPct(line.assetId, '0')
      : setLines(ls => ls.filter(l => l.assetId !== line.assetId));

  const send = async () => {
    if (!dtf) return;
    setBusy(true);
    try {
      await sendDraft(
        await api.prepareManagerTx(dtf, {
          name: 'allocations',
          body: {
            weights: lines
              .filter(l => bpsOf(l.pct) > 0 || l.onChainBps > 0)
              .map(l => ({ assetId: l.assetId, weightBps: bpsOf(l.pct) })),
          },
        }),
      );
      alert(
        'Weights updated',
        'Open Rebalance to trade toward the new targets.',
      );
      router.back();
    } catch (e) {
      alert(
        'Update failed',
        e instanceof Error ? e.message : 'Transaction failed.',
      );
    } finally {
      setBusy(false);
    }
  };

  const update = () => {
    const summary = lines
      .filter(l => bpsOf(l.pct) !== l.onChainBps)
      .map(
        l => `${l.symbol}: ${pctOf(l.onChainBps)}% → ${pctOf(bpsOf(l.pct))}%`,
      )
      .join('\n');
    alert(
      'Update target weights?',
      `${summary}\n\nAssets at 0% are sold down and removed. Trades run from Rebalance afterwards.`,
      [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Sign and update', onPress: () => void send() },
      ],
    );
  };

  const hint =
    total === FULL
      ? changed
        ? 'Ready to update'
        : 'Matches the basket today'
      : total > FULL
        ? `Remove ${pctOf(total - FULL)}%`
        : `Add ${pctOf(FULL - total)}%`;

  return (
    <ManagerBasketScreen
      dtf={dtf}
      loading={loading}
      error={error}
      onRetry={reload}
      title="Target weights"
      info="The share of the basket each asset should hold; weights must total 100%. Updating records new targets on-chain; the trades toward them run from Rebalance."
    >
      {data ? (
        <View style={styles.body}>
          <View style={styles.bar}>
            {lines.map((l, i) =>
              bpsOf(l.pct) > 0 ? (
                <View
                  key={l.assetId}
                  style={{
                    flex: bpsOf(l.pct),
                    backgroundColor: series[i % series.length],
                  }}
                />
              ) : null,
            )}
            {total < FULL ? (
              <View
                style={{ flex: FULL - total, backgroundColor: colors.surface3 }}
              />
            ) : null}
          </View>
          <View style={styles.totalRow}>
            <Text style={[styles.total, total !== FULL && styles.totalOff]}>
              {pctOf(total)}% of 100%
            </Text>
            <Text style={styles.totalHint}>{hint}</Text>
          </View>

          {lines.map((l, i) => {
            const bps = bpsOf(l.pct);
            return (
              <View key={l.assetId} style={styles.row}>
                <View
                  style={[
                    styles.dot,
                    { backgroundColor: series[i % series.length] },
                  ]}
                />
                <TokenLogo
                  uri={l.logoUrl}
                  style={styles.logo}
                  fallback={
                    <View style={[styles.logo, styles.logoFallback]}>
                      <Text style={styles.logoText}>
                        {l.symbol.slice(0, 2)}
                      </Text>
                    </View>
                  }
                />
                <View style={styles.names}>
                  <Text style={styles.symbol}>{l.symbol}</Text>
                  {l.name ? (
                    <Text style={styles.name} numberOfLines={1}>
                      {l.name}
                    </Text>
                  ) : null}
                  {bps !== l.onChainBps ? (
                    <Text style={styles.was}>
                      {l.onChainBps === 0
                        ? 'new'
                        : `now ${pctOf(l.onChainBps)}%`}
                      {bps === 0 ? ' · winds down' : ''}
                    </Text>
                  ) : null}
                </View>
                <View style={styles.inputWrap}>
                  <TextInput
                    value={l.pct}
                    onChangeText={t => setPct(l.assetId, t)}
                    keyboardType="decimal-pad"
                    selectTextOnFocus
                    editable={!busy}
                    style={[styles.input, bps === 0 && styles.inputZero]}
                    selectionColor={colors.gold}
                    accessibilityLabel={`${l.symbol} target weight, percent`}
                  />
                  <Text style={styles.pctSign}>%</Text>
                </View>
                <Pressable
                  onPress={() => remove(l)}
                  disabled={busy}
                  accessibilityRole="button"
                  accessibilityLabel={`Remove ${l.symbol}`}
                  hitSlop={8}
                  style={styles.remove}
                >
                  <Text style={styles.removeText}>×</Text>
                </Pressable>
              </View>
            );
          })}

          {adding ? (
            <View style={styles.candidates}>
              <Text style={styles.candidatesTitle}>ADD AN ASSET</Text>
              {candidates.length === 0 ? (
                <Text style={styles.name}>
                  Every allowed asset is already in this basket.
                </Text>
              ) : (
                <View style={styles.chips}>
                  {candidates.map(a => (
                    <Pressable
                      key={a.id}
                      onPress={() => {
                        setLines(ls => [
                          ...ls,
                          {
                            assetId: a.id,
                            symbol: a.symbol,
                            name: a.name,
                            logoUrl: a.logoUrl,
                            onChainBps: 0,
                            pct: '0',
                          },
                        ]);
                        setAdding(false);
                      }}
                      accessibilityRole="button"
                      style={({ pressed }) => [
                        styles.chip,
                        pressed && styles.pressed,
                      ]}
                    >
                      <Text style={styles.chipText}>{a.symbol}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          ) : (
            <Pressable
              onPress={() => setAdding(true)}
              disabled={busy}
              accessibilityRole="button"
              style={({ pressed }) => [
                styles.addLink,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.addLinkText}>+ Add an asset</Text>
            </Pressable>
          )}

          <View style={styles.actions}>
            <Button
              label={busy ? 'Waiting for confirmation…' : 'Update weights'}
              variant="green"
              disabled={busy || total !== FULL || !changed}
              onPress={update}
            />
          </View>
        </View>
      ) : null}
    </ManagerBasketScreen>
  );
}

const styles = StyleSheet.create({
  body: { paddingHorizontal: space.md, gap: space.md, marginBottom: space.lg },
  bar: {
    flexDirection: 'row',
    height: 12,
    borderRadius: 6,
    overflow: 'hidden',
    backgroundColor: colors.surface3,
  },
  totalRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  total: { fontFamily: fonts.mono, fontSize: 14, color: colors.green },
  totalOff: { color: colors.gold },
  totalHint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.sm,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  logo: { width: 28, height: 28, borderRadius: 14 },
  logoFallback: {
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.textSecondary,
  },
  names: { flex: 1, gap: 1 },
  symbol: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  was: { fontFamily: fonts.regular, fontSize: 12, color: colors.gold },
  inputWrap: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  input: {
    width: 72,
    height: 40,
    textAlign: 'right',
    fontFamily: fonts.mono,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 8,
    paddingHorizontal: space.sm,
  },
  inputZero: { color: colors.muted },
  pctSign: { fontFamily: fonts.mono, fontSize: 14, color: colors.muted },
  remove: { padding: 6 },
  removeText: { fontFamily: fonts.regular, fontSize: 20, color: colors.muted },
  candidates: { gap: space.sm, paddingTop: space.sm },
  candidatesTitle: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 999,
    paddingHorizontal: 14,
    paddingVertical: 8,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  addLink: { paddingVertical: space.sm },
  addLinkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.green },
  actions: { paddingTop: space.sm },
  pressed: { opacity: 0.75 },
});
