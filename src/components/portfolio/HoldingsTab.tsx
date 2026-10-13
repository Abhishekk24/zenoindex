import { router } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { compare, ratioBps, sub } from '../../lib/decimal';
import { formatDecimal, formatRaw, formatSignedBps } from '../../lib/format';
import { signedUsd, usd } from '../../lib/money';
import type { Position } from '../../lib/portfolio';
import type { Dtf } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { listStyles } from './listStyles';
import { SmallButton } from './SmallButton';

/**
 * Each position: name, shares and NAV, P&L, value, and Redeem / Invest.
 * Tapping the position opens its detail screen.
 */
export function HoldingsTab({
  positions,
  costBasis,
  dtfs,
}: {
  positions: Position[];
  costBasis: Record<string, string>;
  dtfs: Map<string, Dtf>;
}) {
  const open = (id: string, side: 'invest' | 'redeem') =>
    router.push({ pathname: '/basket/[id]', params: { id, side } });

  return (
    <View>
      {positions.map((p, i) => {
        const dtf = dtfs.get(p.dtfId);
        const basis = costBasis[p.dtfId];
        const pnl = basis !== undefined ? sub(p.value, basis) : null;
        const up = pnl !== null && compare(pnl, '0') >= 0;
        return (
          <View
            key={p.dtfId}
            style={[
              listStyles.row,
              styles.holding,
              i === positions.length - 1 && listStyles.last,
            ]}
          >
            <Pressable
              onPress={() =>
                router.push({
                  pathname: '/position/[id]',
                  params: { id: p.dtfId },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${dtf?.name ?? p.dtfId} position`}
              style={({ pressed }) => [styles.top, pressed && styles.pressed]}
            >
              <View style={listStyles.fill}>
                <Text style={listStyles.title} numberOfLines={1}>
                  {dtf?.name ?? p.dtfId}
                </Text>
                <Text style={listStyles.meta} numberOfLines={1}>
                  {dtf?.symbol ?? '—'} •{' '}
                  {formatRaw(p.shares, dtf?.shareDecimals ?? 18, 4)} shares •
                  NAV {formatDecimal(dtf?.sharePrice, 4)}
                </Text>
              </View>
              <Text
                style={[
                  styles.pnl,
                  {
                    color:
                      pnl === null
                        ? colors.muted
                        : up
                          ? colors.green
                          : colors.red,
                  },
                ]}
              >
                {pnl === null
                  ? '—'
                  : `${up ? '▲' : '▼'} ${signedUsd(pnl)}${
                      compare(basis!, '0') > 0
                        ? ` · ${formatSignedBps(ratioBps(pnl, basis!))}`
                        : ''
                    }`}
              </Text>
            </Pressable>
            <View style={styles.bottom}>
              <Text style={styles.value}>{usd(p.value)}</Text>
              <View style={styles.actions}>
                <SmallButton
                  label="Redeem"
                  onPress={() => open(p.dtfId, 'redeem')}
                />
                <SmallButton
                  label="Invest"
                  primary
                  onPress={() => open(p.dtfId, 'invest')}
                />
              </View>
            </View>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  holding: { flexDirection: 'column', alignItems: 'stretch' },
  top: { flexDirection: 'row', gap: space.md },
  pressed: { opacity: 0.75 },
  pnl: { fontFamily: fonts.regular, fontSize: 12 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
  },
  value: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
});
