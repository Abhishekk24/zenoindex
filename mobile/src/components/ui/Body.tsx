import React from 'react';
import { StyleProp, Text, TextStyle } from 'react-native';

import { colors, type } from '../../theme/tokens';

/** Body copy; `muted` for secondary text. */
export function Body({
  children,
  muted,
  style,
}: {
  children: React.ReactNode;
  muted?: boolean;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <Text
      style={[
        type.body,
        { color: muted ? colors.muted : colors.textSecondary },
        style,
      ]}
    >
      {children}
    </Text>
  );
}
