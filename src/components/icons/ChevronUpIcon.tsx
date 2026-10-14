import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Chevron pointing up: collapse / open a sheet. */
export function ChevronUpIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M5.5 15 12 8.5l6.5 6.5" />
    </Svg>
  );
}
