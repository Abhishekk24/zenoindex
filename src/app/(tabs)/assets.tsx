/**
 * Manager → Assets: every asset a basket may hold, with its USDG price and
 * 24h / 30d change, best performers first, so a manager can spot what is
 * moving. Tap one to add it to a basket you manage: that opens the basket's
 * Target weights with the asset already listed.
 */
import { Redirect, router, useFocusEffect } from 'expo-router';
import React, { useCallback, useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { Sparkline } from '../../components/charts/Sparkline';
import {
  Badge,
  Empty,
  LoadState,
  Screen,
  TokenLogo,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { useAppMode } from '../../lib/appMode';
import { formatAgo, formatDecimal, formatSignedBps } from '../../lib/format';
import type { Asset, Dtf } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';

async function load() {
  const [assets, baskets] = await Promise.all([
    api.listAssets(),
    api.listManagedDtfs(),
  ]);
  return { assets, baskets };
}

/** Best 30-day change first; assets without a change (unpriced, USDG) last. */
const rank = (a: Asset) => a.stats?.change30dBps ?? Number.NEGATIVE_INFINITY;

const tone = (bps: number | null) =>
  bps === null ? colors.muted : bps >= 0 ? colors.green : colors.red;

export default function ManagerAssetsScreen() {
  const { mode } = useAppMode();
  const { data, error, reload } = useLoad(load, 'manager-assets');
  // The tab stays mounted; re-read when it comes back (prices move, baskets get created).
  useFocusEffect(useCallback(() => reload(), [reload]));
  const [open, setOpen] = useState<string>();
  const sorted = useMemo(
    () => [...(data?.assets ?? [])].sort((a, b) => rank(b) - rank(a)),
    [data],
  );

  if (mode !== 'manager') return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      <AppHeader title="Assets" actions={false} />
      <Screen tabBar>
        {!data ? (
          <LoadState error={error} onRetry={reload} />
        ) : sorted.length === 0 ? (
          <Empty
            title="No assets yet"
            body="Assets the protocol registers appear here with their price and performance."
          />
        ) : (
          <View style={styles.list}>
            {sorted.some(a => a.stats?.demo) ? (
              <Text style={styles.note}>
                Price changes are demo data until a week of daily prices exists.
              </Text>
            ) : null}
            {sorted.map(a => (
              <AssetRow
                key={a.id}
                asset={a}
                baskets={data.baskets}
                open={open === a.id}
                onToggle={() => setOpen(open === a.id ? undefined : a.id)}
              />
            ))}
          </View>
        )}
      </Screen>
    </View>
  );
}

function AssetRow({
  asset: a,
  baskets,
  open,
  onToggle,
}: {
  asset: Asset;
  baskets: Dtf[];
  open: boolean;
  onToggle: () => void;
}) {
  const d1 = a.stats?.change24hBps ?? null;
  const d30 = a.stats?.change30dBps ?? null;
  return (
    <View style={styles.card}>
      <Pressable
        onPress={onToggle}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        style={({ pressed }) => [styles.row, pressed && styles.pressed]}
      >
        <TokenLogo
          uri={a.logoUrl}
          style={styles.logo}
          fallback={
            <View style={[styles.logo, styles.logoFallback]}>
              <Text style={styles.logoText}>{a.symbol.slice(0, 2)}</Text>
            </View>
          }
        />
        <View style={styles.names}>
          <Text style={styles.symbol}>{a.symbol}</Text>
          <Text style={styles.name} numberOfLines={1}>
            {a.name}
          </Text>
        </View>
        {a.stats && a.stats.sparkline.length > 1 ? (
          <Sparkline
            values={a.stats.sparkline}
            height={28}
            style={styles.spark}
          />
        ) : null}
        <View style={styles.figures}>
          <Text style={styles.price}>
            {a.priceUsdg === null
              ? 'No price'
              : // Meme coins trade below $1: show all 6 USDG decimals there.
                `${formatDecimal(a.priceUsdg, Number(a.priceUsdg) >= 1 ? 2 : 6)} USDG`}
          </Text>
          <Text style={styles.changes}>
            <Text style={{ color: tone(d1) }}>
              {d1 === null ? '—' : formatSignedBps(d1)}
            </Text>
            <Text style={styles.changeLabel}> 1d </Text>
            <Text style={{ color: tone(d30) }}>
              {d30 === null ? '—' : formatSignedBps(d30)}
            </Text>
            <Text style={styles.changeLabel}> 30d</Text>
          </Text>
        </View>
      </Pressable>
      {open ? (
        <View style={styles.detail}>
          <View style={styles.meta}>
            {a.priceUpdatedAt ? (
              <Text style={styles.metaText}>
                Priced {formatAgo(a.priceUpdatedAt)}
              </Text>
            ) : null}
            {a.stats?.demo ? <Badge label="Demo" tone="gold" /> : null}
          </View>
          <Text style={styles.addTitle}>ADD TO A BASKET</Text>
          {baskets.length === 0 ? (
            <Text style={styles.name}>
              Create a basket first, then add assets to it here.
            </Text>
          ) : (
            <View style={styles.chips}>
              {baskets.map(b => (
                <Pressable
                  key={b.id}
                  onPress={() =>
                    router.push({
                      pathname: '/manager/[id]/weights',
                      params: { id: b.id, add: a.id },
                    })
                  }
                  accessibilityRole="button"
                  style={({ pressed }) => [
                    styles.chip,
                    pressed && styles.pressed,
                  ]}
                >
                  <Text style={styles.chipText}>{b.symbol}</Text>
                  <Text style={styles.chipHint}>{b.name}</Text>
                </Pressable>
              ))}
            </View>
          )}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { gap: space.sm },
  note: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginBottom: space.xs,
  },
  card: {
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    overflow: 'hidden',
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
  },
  logo: { width: 32, height: 32, borderRadius: 16 },
  logoFallback: {
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    color: colors.textSecondary,
  },
  names: { flex: 1, gap: 1 },
  symbol: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  name: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  spark: { width: 56 },
  figures: { alignItems: 'flex-end', gap: 2 },
  price: { fontFamily: fonts.mono, fontSize: 14, color: colors.text },
  changes: { fontFamily: fonts.mono, fontSize: 12 },
  changeLabel: { color: colors.dim },
  detail: {
    gap: space.sm,
    paddingHorizontal: space.md,
    paddingBottom: space.md,
    paddingTop: space.sm,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  meta: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  metaText: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  addTitle: {
    fontFamily: fonts.mono,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 8,
    gap: 1,
  },
  chipText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  chipHint: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  pressed: { opacity: 0.75 },
});
