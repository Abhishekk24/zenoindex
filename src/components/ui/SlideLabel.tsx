import React from 'react';
import { StyleProp, TextStyle } from 'react-native';
import Animated, {
  interpolateColor,
  useAnimatedStyle,
  type SharedValue,
} from 'react-native-reanimated';

/** A tab label whose colour follows the sliding indicator as it passes. */
export function SlideLabel({
  label,
  index,
  selected,
  x,
  segment,
  on,
  off,
  style,
}: {
  label: string;
  index: number;
  selected: boolean;
  x: SharedValue<number>;
  segment: number;
  on: string;
  off: string;
  style: StyleProp<TextStyle>;
}) {
  const colorStyle = useAnimatedStyle(() => {
    if (!segment) return { color: selected ? on : off };
    const distance = Math.min(Math.abs(x.get() - index * segment) / segment, 1);
    return { color: interpolateColor(distance, [0, 1], [on, off]) };
  });
  // Equal-width tabs: a long label ("Permissioned") on a narrow phone shrinks
  // a little to stay on one line instead of wrapping.
  return (
    <Animated.Text
      style={[style, colorStyle]}
      numberOfLines={1}
      adjustsFontSizeToFit
      minimumFontScale={0.8}
    >
      {label}
    </Animated.Text>
  );
}
