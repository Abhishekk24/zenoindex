import React from 'react';
import Svg, { Path, Rect } from 'react-native-svg';

import type { TabIconProps } from './types';

/** Create tab (manager mode): stacked squares with a plus. */
export function CreateIcon({ color, focused }: TabIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M16 4.5H6.5a2 2 0 0 0-2 2V16"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Rect
        x={8}
        y={8}
        width={12}
        height={12}
        rx={2.5}
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
      />
      <Path
        d="M14 11v6M11 14h6"
        stroke={focused ? '#050706' : color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
