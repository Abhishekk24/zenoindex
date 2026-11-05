import React from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '../../theme/tokens';

export type ProgressStep = {
  key: string;
  label: string;
  state: 'done' | 'now' | 'todo';
  /** Shown under the current step. */
  hint?: string;
};

/** The invest / redeem steps as a checklist: approve, sign, confirm. */
export function TradeProgress({ steps }: { steps: ProgressStep[] }) {
  return (
    <View accessibilityRole="progressbar">
      {steps.map((step, i) => (
        <View key={step.key} style={styles.step}>
          <View style={styles.rail}>
            <View
              style={[
                styles.dot,
                step.state === 'done' && styles.dotDone,
                step.state === 'now' && styles.dotNow,
              ]}
            >
              {step.state === 'now' ? (
                <ActivityIndicator size="small" color={colors.gold} />
              ) : step.state === 'done' ? (
                <Text style={styles.tick}>✓</Text>
              ) : null}
            </View>
            {i < steps.length - 1 && <View style={styles.line} />}
          </View>
          <View style={styles.text}>
            <Text
              style={[
                styles.label,
                step.state === 'todo' && { color: colors.muted },
              ]}
            >
              {step.label}
            </Text>
            {step.state === 'now' && step.hint ? (
              <Text style={styles.hint}>{step.hint}</Text>
            ) : null}
          </View>
        </View>
      ))}
    </View>
  );
}

const DOT = 22;

const styles = StyleSheet.create({
  step: { flexDirection: 'row', gap: space.md },
  rail: { alignItems: 'center' },
  dot: {
    width: DOT,
    height: DOT,
    borderRadius: DOT / 2,
    borderWidth: 1.5,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  dotDone: { backgroundColor: colors.green, borderColor: colors.green },
  dotNow: { borderColor: colors.gold },
  tick: { ...type.small, color: colors.onGold, lineHeight: 16 },
  line: { width: 1, flex: 1, minHeight: 14, backgroundColor: colors.line },
  text: { flex: 1, paddingBottom: space.lg, gap: 2 },
  label: { ...type.body, color: colors.text },
  hint: { ...type.small, color: colors.muted },
});
