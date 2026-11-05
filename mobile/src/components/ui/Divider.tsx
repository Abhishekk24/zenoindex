import React from 'react';
import { StyleSheet, View } from 'react-native';

import { colors } from '../../theme/tokens';

/** Hairline separator. */
export function Divider() {
  return <View style={styles.divider} />;
}

const styles = StyleSheet.create({
  divider: {
    height: StyleSheet.hairlineWidth,
    backgroundColor: colors.lineStrong,
  },
});
