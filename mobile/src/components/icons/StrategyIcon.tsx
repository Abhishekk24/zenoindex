import React from 'react';
import Svg, { Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Header "link" action (design SVG, 12×12 grid): nodes joined by an arrow. */
export function StrategyIcon({ color, size = 18 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 12 12"
      fill="none"
      stroke={color}
      strokeWidth={0.7}
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <Path d="M9.5 8V3.25C9.5 2.7 9.05 2.25 8.5 2.25H6.25" />
      <Path d="M7.5 1L6 2.25L7.5 3.5" />
      <Path d="M2.5 4.5V8" />
      <Path d="M4.25 2.625C4.25 3.52246 3.52246 4.25 2.625 4.25C1.72754 4.25 1 3.52246 1 2.625C1 1.72754 1.72754 1 2.625 1C3.52246 1 4.25 1.72754 4.25 2.625Z" />
      <Path d="M4 9.5C4 10.3284 3.32843 11 2.5 11C1.67157 11 1 10.3284 1 9.5C1 8.67157 1.67157 8 2.5 8C3.32843 8 4 8.67157 4 9.5Z" />
      <Path d="M11 9.5C11 10.3284 10.3284 11 9.5 11C8.67157 11 8 10.3284 8 9.5C8 8.67157 8.67157 8 9.5 8C10.3284 8 11 8.67157 11 9.5Z" />
    </Svg>
  );
}
