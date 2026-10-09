import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';

/** A label/value line inside a Section, with a line above. */
export function SectionRow({
  label,
  sublabel,
  value,
  strong,
}: {
  label: string;
  sublabel?: string;
  value?: React.ReactNode;
  strong?: boolean;
}) {
  return (
    <View style={styles.row}>
      <View style={styles.text}>
        <Text style={strong ? styles.strong : styles.label}>{label}</Text>
        {sublabel ? <Text style={styles.sub}>{sublabel}</Text> : null}
      </View>
      {value}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginHorizontal: space.lg,
    paddingVertical: 14,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  text: { flex: 1, gap: 6 },
  label: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.textSecondary,
  },
  strong: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  sub: {
    fontFamily: fonts.medium,
    fontSize: 10,
    letterSpacing: 0.8,
    color: colors.muted,
  },
});
