import React from 'react';
import { StyleSheet, View } from 'react-native';

import { space } from '../../theme/tokens';

/** Two-column grid of Stats. */
export function StatGrid({ children }: { children: React.ReactNode }) {
  return <View style={styles.grid}>{children}</View>;
}

const styles = StyleSheet.create({
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    rowGap: space.lg,
    columnGap: space.md,
  },
});
