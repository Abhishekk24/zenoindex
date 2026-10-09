import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { colors, fonts } from '../../theme/tokens';

/** Green full-width sign-in action ("Send code", "Verify"). */
export function PrimaryButton({
  label,
  onPress,
  disabled,
  busy,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  busy?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && !busy && styles.disabled,
      ]}
    >
      <Text style={styles.label}>{busy ? 'Please wait…' : label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 48,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    flexDirection: 'row',
    gap: 10,
    marginTop: 12,
    backgroundColor: colors.primaryGreen,
  },
  label: { fontFamily: fonts.medium, fontSize: 15, color: '#ffffff' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
