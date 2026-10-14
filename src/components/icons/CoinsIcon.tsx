import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Fees: a stack of coins. */
export function CoinsIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M5 7c0-1.4 3.1-2.5 7-2.5s7 1.1 7 2.5-3.1 2.5-7 2.5S5 8.4 5 7z" />
      <Path d="M5 7v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5V7" />
      <Path d="M5 12v5c0 1.4 3.1 2.5 7 2.5s7-1.1 7-2.5v-5" />
    </Svg>
  );
}
