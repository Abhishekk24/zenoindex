import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Sign out: an arrow leaving an open circle to the left (design). */
export function SignOutIcon({ color, size = 20 }: IconProps) {
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
      <Path d="M8.5 5.6A8 8 0 1 1 8.5 18.4" />
      <Path d="M14 12H3M6.5 8.5L3 12l3.5 3.5" />
    </Svg>
  );
}
