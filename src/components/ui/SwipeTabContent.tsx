import React, { useState } from 'react';
import { StyleSheet } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';

/** How far (px) or how fast (px/s) a horizontal swipe must go to change tab. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 500;

/**
 * The content under a set of tabs. Swiping left/right moves to the next or
 * previous tab, and the new content slides in from the side it came from.
 * Vertical scrolling is untouched: the swipe only activates when the finger
 * moves sideways first.
 */
export function SwipeTabContent({
  index,
  count,
  onIndexChange,
  children,
}: {
  index: number;
  count: number;
  onIndexChange: (index: number) => void;
  children: React.ReactNode;
}) {
  // Which way the content should slide in: from the right when moving to a
  // later tab, from the left when moving back. Tracked during render.
  const [shown, setShown] = useState(index);
  const [direction, setDirection] = useState<1 | -1>(1);
  if (index !== shown) {
    setDirection(index > shown ? 1 : -1);
    setShown(index);
  }

  // Gesture-handler v2 builder API: Expo Go (SDK 57) ships the v2 native module.
  const swipe = Gesture.Pan()
    .activeOffsetX([-20, 20])
    .failOffsetY([-12, 12])
    .runOnJS(true)
    .onEnd(({ translationX, velocityX }) => {
      const next =
        translationX < -SWIPE_DISTANCE || velocityX < -SWIPE_VELOCITY;
      const previous =
        translationX > SWIPE_DISTANCE || velocityX > SWIPE_VELOCITY;
      if (next && index < count - 1) onIndexChange(index + 1);
      else if (previous && index > 0) onIndexChange(index - 1);
    });

  const entering = (direction > 0 ? SlideInRight : SlideInLeft).duration(240);

  return (
    <GestureDetector gesture={swipe}>
      <Animated.View key={index} entering={entering} style={styles.content}>
        {children}
      </Animated.View>
    </GestureDetector>
  );
}

const styles = StyleSheet.create({
  // Keep a swipeable area even when a tab has little content.
  content: { minHeight: 320 },
});
