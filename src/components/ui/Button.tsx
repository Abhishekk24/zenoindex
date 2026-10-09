import React from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleProp,
  StyleSheet,
  Text,
  ViewStyle,
} from 'react-native';

import { colors, fonts, radius, space, type } from '../../theme/tokens';

type ButtonProps = {
  label: string;
  onPress?: () => void;
  variant?: 'gold' | 'green' | 'outline' | 'ghost';
  disabled?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
};

export function Button({
  label,
  onPress,
  variant = 'gold',
  disabled,
  loading,
  style,
}: ButtonProps) {
  const fill =
    variant === 'gold'
      ? colors.gold
      : variant === 'green'
        ? colors.primaryGreen
        : 'transparent';
  const fg =
    variant === 'gold'
      ? colors.onGold
      : variant === 'ghost'
        ? colors.gold
        : colors.text;
  const inactive = disabled || loading;
  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: fill },
        variant === 'outline' && styles.outline,
        pressed && styles.pressed,
        inactive && styles.inactive,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[type.body, styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.xl,
  },
  outline: { borderWidth: 1, borderColor: colors.lineControl },
  pressed: { opacity: 0.8 },
  inactive: { opacity: 0.45 },
  label: { fontFamily: fonts.semibold },
});
