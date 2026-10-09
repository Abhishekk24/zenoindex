import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, type } from '../../theme/tokens';

/** Large screen title. */
export function Display({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { ...type.display, color: colors.text },
});
