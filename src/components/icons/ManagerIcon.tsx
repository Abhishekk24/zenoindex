import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Manager filter: a person in a hexagon. */
export function ManagerIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M12 2.5l8.2 4.75v9.5L12 21.5l-8.2-4.75v-9.5z" />
      <Circle cx={12} cy={10} r={2.3} />
      <Path d="M8.3 16.3c.8-1.8 2.1-2.7 3.7-2.7s2.9.9 3.7 2.7" />
    </Svg>
  );
}
