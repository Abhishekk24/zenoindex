import React from 'react';
import { Pressable, StyleSheet } from 'react-native';

import { colors } from '../../theme/tokens';

/** Round outlined icon button (header actions). */
export function IconButton({
  icon,
  onPress,
  active,
  filled,
  accessibilityLabel,
}: {
  icon: React.ReactNode;
  onPress: () => void;
  /** A filter is applied or its panel is open. */
  active?: boolean;
  /** Solid background (the primary action, e.g. search). */
  filled?: boolean;
  accessibilityLabel: string;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ selected: active }}
      hitSlop={4}
      style={({ pressed }) => [
        styles.button,
        filled && styles.filled,
        active && styles.active,
        pressed && styles.pressed,
      ]}
    >
      {icon}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    alignItems: 'center',
    justifyContent: 'center',
  },
  filled: { backgroundColor: colors.surface3 },
  active: { borderColor: colors.goldLine, backgroundColor: colors.goldSoft },
  pressed: { opacity: 0.75 },
});
