import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Corporate actions: a document with a folded corner. */
export function DocumentStackIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M14 3.5H7.5a2 2 0 0 0-2 2v13a2 2 0 0 0 2 2h9a2 2 0 0 0 2-2V8z" />
      <Path d="M14 3.5V8h4.5" />
      <Path d="M9 13h6M9 16.5h4" />
    </Svg>
  );
}
