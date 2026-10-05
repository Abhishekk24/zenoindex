/** Tab bar icons (24px line icons). */
import React from 'react';
import Svg, { Circle, Path } from 'react-native-svg';

type IconProps = { color: string; size?: number };

export function ExploreIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    >
      <Circle cx={11} cy={11} r={7} />
      <Path d="M20 20l-4-4" strokeLinecap="round" />
    </Svg>
  );
}

export function PortfolioIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    >
      <Path d="M12 3a9 9 0 1 0 9 9h-9z" strokeLinejoin="round" />
      <Path d="M15 3.5A9 9 0 0 1 20.5 9H15z" strokeLinejoin="round" />
    </Svg>
  );
}

export function ProfileIcon({ color, size = 24 }: IconProps) {
  return (
    <Svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={1.8}
    >
      <Circle cx={12} cy={8} r={4} />
      <Path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6" strokeLinecap="round" />
    </Svg>
  );
}
