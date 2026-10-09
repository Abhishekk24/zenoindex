import React from 'react';
import { StyleSheet, Text } from 'react-native';

import { colors, type } from '../../theme/tokens';

/** Section heading. */
export function Title({ children }: { children: React.ReactNode }) {
  return <Text style={styles.text}>{children}</Text>;
}

const styles = StyleSheet.create({
  text: { ...type.title, color: colors.text },
});
