import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Opens outside the app: a box with an arrow leaving its corner. */
export function ExternalLinkIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M13.5 4.5h6v6" />
      <Path d="M19.5 4.5 11 13" />
      <Path d="M17 14v4.5a1.5 1.5 0 0 1-1.5 1.5h-10A1.5 1.5 0 0 1 4 18.5v-10A1.5 1.5 0 0 1 5.5 7H10" />
    </Svg>
  );
}
