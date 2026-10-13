import React from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';

import { openInAppBrowser } from '../../lib/browser';
import { colors, type } from '../../theme/tokens';

/**
 * Gold text that opens `url` in the in-app browser (explorer links). Renders
 * plain text when there is no URL, so callers needn't branch.
 */
export function LinkText({
  label,
  url,
  mono,
  size = 13,
}: {
  label: string;
  url: string | null | undefined;
  mono?: boolean;
  size?: number;
}) {
  const style = [
    mono ? type.mono : type.small,
    { fontSize: size, lineHeight: size * 1.35 },
  ];
  if (!url) return <Text style={[style, { color: colors.text }]}>{label}</Text>;
  return (
    <Pressable
      onPress={() => void openInAppBrowser(url)}
      accessibilityRole="link"
      hitSlop={8}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <Text style={[style, { color: colors.gold }]}>{label} ↗</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({ pressed: { opacity: 0.7 } });
