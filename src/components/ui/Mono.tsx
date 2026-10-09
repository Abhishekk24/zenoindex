import React from 'react';
import { Text } from 'react-native';

import { colors, type } from '../../theme/tokens';

/** Monospace text for addresses, hashes and figures. */
export function Mono({
  children,
  size = 13,
  color = colors.text,
  numberOfLines,
}: {
  children: React.ReactNode;
  size?: number;
  color?: string;
  numberOfLines?: number;
}) {
  return (
    <Text
      numberOfLines={numberOfLines}
      style={[type.mono, { fontSize: size, lineHeight: size * 1.35, color }]}
    >
      {children}
    </Text>
  );
}
