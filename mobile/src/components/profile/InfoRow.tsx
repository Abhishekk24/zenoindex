import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';

/** A label over a value, with a line underneath (Account, Eligibility). */
export function InfoRow({
  label,
  value,
  extra,
  right,
  last,
}: {
  label: string;
  value: string;
  /** Inline after the value, e.g. a "Verified" tag. */
  extra?: React.ReactNode;
  /** Right-aligned action, e.g. "Get started". */
  right?: React.ReactNode;
  last?: boolean;
}) {
  return (
    <View style={[styles.row, last && styles.last]}>
      <View style={styles.text}>
        <Text style={styles.label}>{label}</Text>
        <View style={styles.valueLine}>
          <Text style={styles.value}>{value}</Text>
          {extra}
        </View>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: 18,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  last: { borderBottomWidth: 0 },
  text: { flex: 1, gap: 6 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  valueLine: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
  },
  value: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});
