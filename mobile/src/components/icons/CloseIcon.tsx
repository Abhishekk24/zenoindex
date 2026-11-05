import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Close: dismiss or cancel the current screen. */
export function CloseIcon({ color, size = 16 }: IconProps) {
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
      <Path d="m6 6 12 12M18 6 6 18" />
    </Svg>
  );
}
