import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { colors, space, type } from '../../theme/tokens';
import { Mono } from './Mono';

/** A key/value line inside a card. */
export function Row({
  label,
  value,
  mono = true,
}: {
  label: string;
  value: React.ReactNode;
  mono?: boolean;
}) {
  return (
    <View style={styles.row}>
      <Text style={[type.small, { color: colors.muted }]}>{label}</Text>
      {typeof value === 'string' ? (
        mono ? (
          <Mono>{value}</Mono>
        ) : (
          <Text style={[type.small, { color: colors.text }]}>{value}</Text>
        )
      ) : (
        value
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
    minHeight: 24,
  },
});
