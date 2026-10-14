import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Open details: an arrow in a circle. */
export function ArrowCircleIcon({ color, size = 16 }: IconProps) {
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
      <Path d="M9 12h6M12.5 9l3 3-3 3" />
    </Svg>
  );
}
