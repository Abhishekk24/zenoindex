import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './types';

export function SearchIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
      strokeLinecap="round"
    >
      <Circle cx={11} cy={11} r={6.5} />
      <Path d="M20 20l-4.2-4.2" />
    </Svg>
  );
}
