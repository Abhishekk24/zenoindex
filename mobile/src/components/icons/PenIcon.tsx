import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Sign: a pen nib. */
export function PenIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M14.5 5.5 18.5 9.5" />
      <Path d="M4 20l1.2-4.8L15.8 4.6a1.4 1.4 0 0 1 2 0l1.6 1.6a1.4 1.4 0 0 1 0 2L8.8 18.8z" />
    </Svg>
  );
}
