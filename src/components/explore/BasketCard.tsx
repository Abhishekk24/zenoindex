/** A basket in the Explore list (design: Explore mockup). */
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AssetMap, isComingSoon, symbolOf } from '../../lib/basket';
import { formatBps, formatDecimal, shortAddress } from '../../lib/format';
import type { Dtf } from '../../lib/types';
import { colors, fonts, radius } from '../../theme/tokens';
import { Stripes } from '../ui';
import { BasketStat } from './BasketStat';

/** How many constituent avatars to show before collapsing into "+n". */
const MAX_AVATARS = 5;

export function BasketCard({
  dtf,
  assets,
  onPress,
}: {
  dtf: Dtf;
  assets: AssetMap;
  onPress: () => void;
}) {
  const tickers = dtf.weights.map(w => symbolOf(w.assetId, assets));
  const shown =
    tickers.length > MAX_AVATARS
      ? [
          ...tickers.slice(0, MAX_AVATARS - 1),
          `+${tickers.length - MAX_AVATARS + 1}`,
        ]
      : tickers;
  const comingSoon = isComingSoon(dtf);

  return (
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

        <View style={styles.constituents}>
          <View style={styles.avatars}>
            {shown.map((ticker, i) => (
              <View
                key={`${ticker}-${i}`}
                style={[styles.avatar, i > 0 && styles.avatarOverlap]}
              >
                <Text style={styles.avatarText}>
                  {ticker.startsWith('+')
                    ? ticker
                    : ticker.slice(0, 2).toUpperCase()}
                </Text>
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
            label="Mgmt fee"
            value={formatBps(dtf.fees.managementBps)}
          />
        </View>
      </View>
    </Pressable>
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
  },
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
  stats: { flexDirection: 'row', paddingHorizontal: 6 },
});
