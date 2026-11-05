import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Chevron pointing right: "opens something" on a row. */
export function ChevronRightIcon({ color, size = 16 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9 5.5l6.5 6.5L9 18.5" />
    </Svg>
  );
}
