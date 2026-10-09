import React from 'react';
import { Text } from 'react-native';

import { colors, type } from '../../theme/tokens';

/** Small uppercase label; gold when `accent`. */
export function Label({
  children,
  accent,
}: {
  children: React.ReactNode;
  accent?: boolean;
}) {
  return (
    <Text style={[type.label, { color: accent ? colors.gold : colors.muted }]}>
      {children}
    </Text>
  );
}
