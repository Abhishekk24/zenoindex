import React from 'react';
import { ScrollView, StyleSheet } from 'react-native';

import { space } from '../../theme/tokens';

/** A horizontally scrolling row of filter chips (Explore filter panels). */
export function ChipRow({ children }: { children: React.ReactNode }) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.scroll}
      contentContainerStyle={styles.row}
      keyboardShouldPersistTaps="handled"
    >
      {children}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scroll: { flexGrow: 0 },
  row: {
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingTop: space.md,
  },
});
