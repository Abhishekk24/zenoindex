import Svg, { Circle, Path } from 'react-native-svg';

import type { IconProps } from './types';

/** Wallet: a filled wallet with its clasp (sign-in "connect with" button). */
export function WalletIcon({ color, size = 20 }: IconProps) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M5 5.5h12.5A1.5 1.5 0 0 1 19 7v1H6a1 1 0 0 0 0 2h14a1.5 1.5 0 0 1 1.5 1.5v6A2.5 2.5 0 0 1 19 20H5a2.5 2.5 0 0 1-2.5-2.5v-9A3 3 0 0 1 5 5.5z"
        fill={color}
      />
      <Circle cx={17} cy={14.5} r={1.4} fill="#0c0f0e" />
    </Svg>
  );
}
