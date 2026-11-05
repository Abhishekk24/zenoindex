import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import { colors } from '../../theme/tokens';

/** Notice: an exclamation in a gold badge (Eligibility). */
export function NoticeIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M12 1.8l2.6 1.9 3.2.1 1 3 2.5 2-1 3.1 1 3.1-2.5 2-1 3-3.2.1L12 22.2l-2.6-1.9-3.2-.1-1-3-2.5-2 1-3.1-1-3.1 2.5-2 1-3 3.2-.1z"
        fill={colors.gold}
      />
      <Path
        d="M12 7.5v5.5"
        stroke={colors.onGold}
        strokeWidth={2}
        strokeLinecap="round"
      />
      <Circle cx={12} cy={16.3} r={1.2} fill={colors.onGold} />
    </Svg>
  );
}
