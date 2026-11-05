import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useSlide } from '../../hooks/useSlide';
import { colors, fonts, radius, type } from '../../theme/tokens';
import { SlideLabel } from './SlideLabel';
import type { TabOption } from './types';

const PADDING = 3;
const BORDER = 1;

/**
 * One-of-n pill selector. A single gold pill sits behind the tabs and slides
 * to the selected one; each label's colour follows the pill as it passes.
 */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
}: {
  options: readonly TabOption<T>[];
  value: T;
  onChange: (value: T) => void;
}) {
  const [width, setWidth] = useState(0);
  const index = Math.max(
    0,
    options.findIndex(option => option.value === value),
  );
  // Tabs are equal width (flex: 1): the inner width shared out.
  const segment =
    width > 0 ? (width - 2 * (PADDING + BORDER)) / options.length : 0;
  const x = useSlide(index, segment);
  const pillStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      style={styles.segmented}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.pill, { width: segment }, pillStyle]}
        />
      )}
      {options.map((option, i) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          style={styles.segment}
        >
          <SlideLabel
            label={option.label}
            index={i}
            selected={i === index}
            x={x}
            segment={segment}
            on={colors.onGold}
            off={colors.muted}
            style={[type.small, styles.label]}
          />
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  segmented: {
    flexDirection: 'row',
    backgroundColor: colors.surface2,
    borderRadius: radius.pill,
    borderColor: colors.line,
    borderWidth: BORDER,
    padding: PADDING,
  },
  pill: {
    position: 'absolute',
    top: PADDING,
    bottom: PADDING,
    left: PADDING,
    borderRadius: radius.pill,
    backgroundColor: colors.gold,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.pill,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.semibold },
});
