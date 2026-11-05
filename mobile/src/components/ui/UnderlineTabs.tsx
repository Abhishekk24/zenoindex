import React, { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle } from 'react-native-reanimated';

import { useSlide } from '../../hooks/useSlide';
import { colors, fonts } from '../../theme/tokens';
import { SlideLabel } from './SlideLabel';
import type { TabOption } from './types';

/**
 * Text tabs over a full-width rule; a white underline slides to the selected
 * tab (Explore, Profile, Portfolio).
 */
export function UnderlineTabs<T extends string>({
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
  const segment = width > 0 ? width / options.length : 0;
  const x = useSlide(index, segment);
  const lineStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.get() }],
  }));

  return (
    <View
      style={styles.tabs}
      onLayout={e => setWidth(e.nativeEvent.layout.width)}
    >
      {options.map((option, i) => (
        <Pressable
          key={option.value}
          onPress={() => onChange(option.value)}
          accessibilityRole="tab"
          accessibilityState={{ selected: i === index }}
          style={styles.tab}
        >
          <SlideLabel
            label={option.label}
            index={i}
            selected={i === index}
            x={x}
            segment={segment}
            on={colors.text}
            off={colors.muted}
            style={styles.label}
          />
        </Pressable>
      ))}
      {segment > 0 && (
        <Animated.View
          pointerEvents="none"
          style={[styles.underline, { width: segment }, lineStyle]}
        />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  tab: {
    flex: 1,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  label: { fontFamily: fonts.medium, fontSize: 15 },
  underline: {
    position: 'absolute',
    left: 0,
    bottom: -1,
    height: 2,
    backgroundColor: colors.text,
  },
});
