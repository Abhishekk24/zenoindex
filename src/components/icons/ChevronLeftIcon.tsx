import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Chevron pointing left: back. */
export function ChevronLeftIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M15 5.5 8.5 12l6.5 6.5" />
    </Svg>
  );
}
