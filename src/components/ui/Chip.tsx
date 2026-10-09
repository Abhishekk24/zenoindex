import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, radius, type } from '../../theme/tokens';

/** Toggleable filter chip. */
export function Chip({
  label,
  selected,
  onPress,
}: {
  label: string;
  selected: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected }}
      style={[styles.chip, selected && styles.selected]}
    >
      <Text
        style={[
          type.small,
          { color: selected ? colors.gold : colors.textSecondary },
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    paddingHorizontal: 14,
    minHeight: 34,
    justifyContent: 'center',
  },
  selected: { borderColor: colors.goldLine, backgroundColor: colors.goldSoft },
});
