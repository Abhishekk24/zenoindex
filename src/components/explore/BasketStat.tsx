import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, fonts } from '../../theme/tokens';

/** One figure in a basket card's stats row: "NAV / SHARE  1.0000". */
export function BasketStat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label.toUpperCase()}</Text>
      <Text style={styles.value} numberOfLines={1}>
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stat: { flex: 1, gap: 6 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 1,
    color: colors.muted,
  },
  value: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
});
