import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { TabIconProps } from './types';

/**
 * Baskets tab (manager mode): a shopping basket; filled when active. The tab
 * bar sets the colour.
 */
export function BasketsIcon({ color, focused }: TabIconProps) {
  return (
    <Svg width={20} height={20} viewBox="0 0 24 24" fill="none">
      <Path
        d="M3.5 9.5h17l-1.6 9.1a2 2 0 0 1-2 1.65H7.1a2 2 0 0 1-2-1.65z"
        fill={focused ? color : 'none'}
        stroke={color}
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <Path
        d="M8 9.5 10.5 4M16 9.5 13.5 4"
        stroke={color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
      <Path
        d="M9.5 13v3.5M14.5 13v3.5"
        stroke={focused ? '#050706' : color}
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}
