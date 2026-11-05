import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, radius, type } from '../../theme/tokens';
import type { BadgeTone } from './types';

const TONES: Record<BadgeTone, { fg: string; bg: string; border: string }> = {
  gold: { fg: colors.gold, bg: colors.goldSoft, border: colors.goldLine },
  green: { fg: colors.green, bg: colors.greenSoft, border: colors.greenLine },
  neutral: { fg: colors.muted, bg: 'transparent', border: colors.lineStrong },
  danger: { fg: colors.danger, bg: colors.dangerSoft, border: colors.danger },
};

/** Pill badge: Active, Open, Permissioned, Coming soon. */
export function Badge({
  label,
  tone = 'neutral',
}: {
  label: string;
  tone?: BadgeTone;
}) {
  const c = TONES[tone];
  return (
    <View
      style={[styles.badge, { backgroundColor: c.bg, borderColor: c.border }]}
    >
      <Text style={[type.label, styles.text, { color: c.fg }]}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignSelf: 'flex-start',
    borderRadius: radius.pill,
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 3,
  },
  text: { letterSpacing: 0.4 },
});
