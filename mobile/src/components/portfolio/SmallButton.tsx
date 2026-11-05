import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts, radius, space } from '../../theme/tokens';

/** Compact row action: outlined, or green when `primary` (Redeem / Invest). */
export function SmallButton({
  label,
  primary,
  onPress,
}: {
  label: string;
  primary?: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.button,
        primary ? styles.primary : styles.outline,
        pressed && styles.pressed,
      ]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 38,
    paddingHorizontal: space.lg,
    borderRadius: radius.sm,
    alignItems: 'center',
    justifyContent: 'center',
  },
  outline: { borderWidth: 1, borderColor: colors.lineStrong },
  primary: { backgroundColor: colors.primaryGreen },
  pressed: { opacity: 0.8 },
  label: { fontFamily: fonts.regular, fontSize: 13, color: colors.text },
});
