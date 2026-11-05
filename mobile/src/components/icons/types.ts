import type { ColorValue } from 'react-native';

export type IconProps = { color: ColorValue; size?: number };

/** Matches the tab bar's tabBarIcon props, so tab icons can be passed directly. */
export type TabIconProps = IconProps & { focused?: boolean };
