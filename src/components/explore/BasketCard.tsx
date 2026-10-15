/**
 * A basket in the Explore list (design: Explore mockup). Manager mode reuses it
 * with a ⋮ menu in `accessory`.
 */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AssetMap, isComingSoon, symbolOf } from '../../lib/basket';
import { formatDecimal, formatSignedBps, shortAddress } from '../../lib/format';
import type { Dtf } from '../../lib/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Sparkline } from '../charts/Sparkline';
import { Stripes, TokenLogo } from '../ui';
import { BasketStat } from './BasketStat';

/** How many constituent avatars to show before collapsing into "+n". */
const MAX_AVATARS = 5;

/** Up green, down red, flat or unknown neutral. */
const trendColor = (bps: number | null) =>
  bps === null || bps === 0 ? colors.text : bps > 0 ? colors.green : colors.red;

export function BasketCard({
  dtf,
  assets,
  onPress,
  accessory,
}: {
  dtf: Dtf;
  assets: AssetMap;
  onPress: () => void;
  /** Top-right control over the card, e.g. the manager ⋮ menu. */
  accessory?: React.ReactNode;
}) {
  const tickers = dtf.weights.map(w => ({
    ticker: symbolOf(w.assetId, assets),
    logo: assets.get(w.assetId)?.logoUrl ?? null,
  }));
  const shown =
    tickers.length > MAX_AVATARS
      ? [
          ...tickers.slice(0, MAX_AVATARS - 1),
          { ticker: `+${tickers.length - MAX_AVATARS + 1}`, logo: null },
        ]
      : tickers;
  const comingSoon = isComingSoon(dtf);
  const month = dtf.stats?.change30dBps ?? null;
  const day = dtf.stats?.change24hBps ?? null;

  return (
    <View>
      <Pressable
        onPress={onPress}
        accessibilityRole="button"
        accessibilityLabel={`${dtf.name}, ${dtf.symbol}`}
        style={({ pressed }) => [styles.card, pressed && styles.pressed]}
      >
        <View style={styles.stripes} pointerEvents="none">
          <Stripes height={84} stripe={2} gap={7} opacity={0.16} />
        </View>

        <View style={styles.body}>
          <Text style={styles.name} numberOfLines={1}>
            {dtf.name}
          </Text>
          <Text style={styles.meta} numberOfLines={1}>
            {dtf.symbol} · {shortAddress(dtf.manager)}
          </Text>

          {/* The figure people compare baskets by: how the share price did lately. */}
          <View style={styles.performance}>
            <View>
              <Text style={[styles.returnValue, { color: trendColor(month) }]}>
                {month === null ? '—' : formatSignedBps(month)}
              </Text>
              <View style={styles.returnLabelRow}>
                <Text style={styles.returnLabel}>Past 30 days</Text>
                {dtf.stats?.demo ? <Text style={styles.demo}>Demo</Text> : null}
              </View>
            </View>
            <Sparkline
              values={dtf.stats?.sparkline ?? []}
              style={styles.spark}
            />
          </View>

          <View style={styles.constituents}>
            <View style={styles.avatars}>
              {shown.map(({ ticker, logo }, i) => (
                <View
                  key={`${ticker}-${i}`}
                  style={[styles.avatar, i > 0 && styles.avatarOverlap]}
                >
                  <TokenLogo
                    uri={logo}
                    style={styles.avatarLogo}
                    fallback={
                      <Text style={styles.avatarText}>
                        {ticker.startsWith('+')
                          ? ticker
                          : ticker.slice(0, 2).toUpperCase()}
                      </Text>
                    }
                  />
                </View>
              ))}
            </View>
            <Text style={styles.count}>
              {tickers.length} constituent{tickers.length === 1 ? '' : 's'}
            </Text>
            <View
              style={[styles.status, comingSoon ? styles.soon : styles.active]}
            >
              <Text
                style={[
                  styles.statusText,
                  { color: comingSoon ? colors.muted : colors.green },
                ]}
              >
                {comingSoon ? 'Coming soon' : 'Active'}
              </Text>
            </View>
          </View>

          <View style={styles.rule} />

          <View style={styles.stats}>
            <BasketStat
              label="NAV / share"
              value={formatDecimal(dtf.sharePrice, 4)}
            />
            <BasketStat label="AUM" value={formatDecimal(dtf.aum, 0)} />
            <BasketStat
              label="Today"
              value={day === null ? '—' : formatSignedBps(day)}
              color={day === null ? undefined : trendColor(day)}
            />
          </View>
        </View>
      </Pressable>
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
    </View>
  );
}

const AVATAR = 28;

const styles = StyleSheet.create({
  card: {
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  pressed: { borderColor: colors.lineStrong },
  accessory: { position: 'absolute', top: 16, right: 14 },
  stripes: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '62%',
    height: 84,
  },
  body: { paddingHorizontal: 20, paddingTop: 22, paddingBottom: 20 },
  name: { fontFamily: fonts.medium, fontSize: 19, color: colors.text },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: 4,
  },
  constituents: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 22,
  },
  avatars: { flexDirection: 'row' },
  avatar: {
    width: AVATAR,
    height: AVATAR,
    borderRadius: AVATAR / 2,
    backgroundColor: colors.gold,
    borderWidth: 1.5,
    borderColor: colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarLogo: { width: '100%', height: '100%' },
  avatarOverlap: { marginLeft: -9 },
  avatarText: {
    fontFamily: fonts.semibold,
    fontSize: 10,
    color: colors.onGold,
  },
  count: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    marginLeft: 12,
  },
  status: {
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 4,
  },
  active: { borderColor: colors.greenLine },
  soon: { borderColor: colors.lineStrong },
  statusText: { fontFamily: fonts.regular, fontSize: 13 },
  rule: { height: 1, backgroundColor: colors.line, marginVertical: 18 },
  performance: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 16,
    marginTop: 18,
  },
  returnValue: {
    fontFamily: fonts.medium,
    fontSize: 30,
    lineHeight: 34,
    letterSpacing: -0.5,
  },
  returnLabelRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 2,
  },
  returnLabel: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  demo: {
    fontFamily: fonts.medium,
    fontSize: 11,
    color: colors.gold,
    borderWidth: 1,
    borderColor: colors.goldStrong,
    borderRadius: 6,
    paddingHorizontal: 6,
    paddingVertical: 1,
  },
  spark: { flex: 1 },
  stats: { flexDirection: 'row', paddingHorizontal: 6 },
});
