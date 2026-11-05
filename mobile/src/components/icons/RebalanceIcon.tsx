import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Rebalance: two arrows turning around a circle. */
export function RebalanceIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.6}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M19.5 12a7.5 7.5 0 0 1-12.8 5.3" />
      <Path d="M4.5 12a7.5 7.5 0 0 1 12.8-5.3" />
      <Path d="M17.5 3.5v3.3h-3.3" />
      <Path d="M6.5 20.5v-3.3h3.3" />
    </Svg>
  );
}
