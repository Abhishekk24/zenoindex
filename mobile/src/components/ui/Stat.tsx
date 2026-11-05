import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, type } from '../../theme/tokens';
import { Label } from './Label';

/** A labelled figure: "NAV / SHARE  1.0421". */
export function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'up' | 'down';
}) {
  const hintColor =
    tone === 'up'
      ? colors.green
      : tone === 'down'
        ? colors.danger
        : colors.muted;
  return (
    <View style={styles.stat}>
      <Label>{label}</Label>
      <Text
        style={[type.figure, { color: colors.text }]}
        numberOfLines={1}
        adjustsFontSizeToFit
      >
        {value}
      </Text>
      {hint ? (
        <Text style={[type.small, { color: hintColor }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flexBasis: '47%', flexGrow: 1, gap: 2 },
});
