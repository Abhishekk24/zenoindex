import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Info: an i in a circle (tooltips). */
export function InfoIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M12 20.5a8.5 8.5 0 1 0 0-17 8.5 8.5 0 0 0 0 17z" />
      <Path d="M12 11v5" />
      <Path d="M12 7.9v.1" />
    </Svg>
  );
}
