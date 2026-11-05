import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { fonts } from '../../theme/tokens';

/** White full-width sign-in option ("Continue with Google", "Connect wallet"). */
export function LightButton({
  label,
  icon,
  onPress,
  disabled,
}: {
  label: string;
  icon?: React.ReactNode;
  onPress: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.button,
        pressed && styles.pressed,
        disabled && styles.disabled,
      ]}
    >
      {icon}
      <Text style={styles.label}>{label}</Text>
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
    backgroundColor: '#ffffff',
  },
  label: { fontFamily: fonts.medium, fontSize: 15, color: '#050706' },
  pressed: { opacity: 0.85 },
  disabled: { opacity: 0.5 },
});
