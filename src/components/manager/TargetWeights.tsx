/**
 * Manager → Rebalance → Target weights: re-weight the basket's assets with
 * sliders, then prepare the setTargetAllocations transaction
 * (POST /manager/dtfs/:id/allocations/prepare). Trades happen afterwards as
 * Rebalance actions. A 0% asset winds down and leaves the basket.
 * shortcut: whole-percent steps and the current assets only; a fractional
 * target shows rounded. Adding an asset needs a picker like the Create flow's.
 */
import Slider from '@react-native-community/slider';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import type { ManagerSlot } from '../../lib/api';
import { shortAddress } from '../../lib/format';
import { colors, fonts, space } from '../../theme/tokens';
import { Button } from '../ui';

export type Weight = { assetId: string; weightBps: number };

export function TargetWeights({
  slots,
  disabled,
  onPrepare,
}: {
  slots: ManagerSlot[];
  disabled: boolean;
  onPrepare: (weights: Weight[]) => void;
}) {
  const [pct, setPct] = useState<Record<string, number>>(() =>
    Object.fromEntries(
      slots.map(s => [s.assetId, Math.round(s.targetBps / 100)]),
    ),
  );
  const of = (s: ManagerSlot) => pct[s.assetId] ?? 0;
  const total = slots.reduce((sum, s) => sum + of(s), 0);
  const changed = slots.some(s => of(s) * 100 !== s.targetBps);
  const ready = total === 100 && changed && !disabled;

  return (
    <View style={styles.root}>
      <View style={styles.head}>
        <Text style={styles.title}>TARGET WEIGHTS</Text>
        <Text style={[styles.total, total !== 100 && styles.totalOff]}>
          {total} / 100%
        </Text>
      </View>
      {slots.map(s => {
        const name = s.symbol ?? shortAddress(s.assetId);
        const weight = of(s);
        // What this asset can take without the total passing 100%.
        const room = Math.max(0, 100 - (total - weight));
        return (
          <View key={s.assetId} style={styles.row}>
            <View style={styles.rowTop}>
              <Text style={styles.name}>{name}</Text>
              <Text style={styles.weight}>
                {weight}%
                {weight * 100 !== s.targetBps
                  ? `  (now ${s.targetBps / 100}%)`
                  : ''}
              </Text>
            </View>
            <Slider
              value={weight}
              minimumValue={0}
              maximumValue={Math.max(room, 1)}
              step={1}
              onValueChange={v => setPct(p => ({ ...p, [s.assetId]: v }))}
              minimumTrackTintColor={colors.gold}
              maximumTrackTintColor={colors.lineStrong}
              thumbTintColor={colors.gold}
              accessibilityLabel={`${name} target weight, percent`}
              style={styles.slider}
            />
          </View>
        );
      })}
      <Text style={styles.hint}>
        {total !== 100
          ? `Weights must total 100% (${total > 100 ? 'remove' : 'add'} ${Math.abs(100 - total)}%).`
          : 'Setting a weight to 0% sells that asset down and removes it from the basket.'}
      </Text>
      <Button
        label="Prepare weights update"
        variant="outline"
        disabled={!ready}
        onPress={() =>
          onPrepare(
            slots.map(s => ({ assetId: s.assetId, weightBps: of(s) * 100 })),
          )
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    marginHorizontal: space.md,
    marginBottom: space.lg,
    padding: space.lg,
    gap: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
  },
  head: { flexDirection: 'row', justifyContent: 'space-between' },
  title: {
    fontFamily: fonts.mono,
    fontSize: 12,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  total: { fontFamily: fonts.mono, fontSize: 12, color: colors.green },
  totalOff: { color: colors.gold },
  row: { gap: 2 },
  rowTop: { flexDirection: 'row', justifyContent: 'space-between' },
  name: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  weight: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  slider: { height: 32, marginHorizontal: -6 },
  hint: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
});
