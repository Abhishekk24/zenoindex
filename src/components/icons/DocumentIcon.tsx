import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Document: a page with a folded corner and text lines (legal documents). */
export function DocumentIcon({ color, size = 20 }: IconProps) {
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
      <Path d="M14 2.75H7A2.25 2.25 0 0 0 4.75 5v14A2.25 2.25 0 0 0 7 21.25h10A2.25 2.25 0 0 0 19.25 19V8z" />
      <Path d="M14 2.75V8h5.25M8.5 13h7M8.5 16.5h5" />
    </Svg>
  );
}
