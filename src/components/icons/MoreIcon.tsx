import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** More: three vertical dots (card menu). */
export function MoreIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M12 5.5v.01M12 12v.01M12 18.5v.01" />
    </Svg>
  );
}
