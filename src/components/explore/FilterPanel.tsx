/**
 * Explore's filter rows (strategy, manager, "Clear filters") slide in and out
 * instead of popping: enter 220ms, drop 8px + fade in; exit softer, 160ms, lift
 * 4px + fade out. Strong ease-out both ways, on the UI thread (Reanimated
 * layout animations). With Reduce Motion on, they only fade.
 *
 * The content below moves with ExploreBelowPanels, so the list glides down
 * instead of jumping when a row appears.
 */
import React from 'react';
import Animated, {
  Easing,
  LinearTransition,
  useReducedMotion,
  withTiming,
  type EntryExitAnimationFunction,
} from 'react-native-reanimated';
import type { StyleProp, ViewStyle } from 'react-native';

const EASE_OUT = Easing.bezier(0.23, 1, 0.32, 1);
const ENTER_MS = 220;
const EXIT_MS = 160;

const enter: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0, transform: [{ translateY: -8 }] },
    animations: {
      opacity: withTiming(1, { duration: ENTER_MS, easing: EASE_OUT }),
      transform: [
        { translateY: withTiming(0, { duration: ENTER_MS, easing: EASE_OUT }) },
      ],
    },
  };
};

const exit: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1, transform: [{ translateY: 0 }] },
    animations: {
      opacity: withTiming(0, { duration: EXIT_MS, easing: EASE_OUT }),
      transform: [
        { translateY: withTiming(-4, { duration: EXIT_MS, easing: EASE_OUT }) },
      ],
    },
  };
};

const fadeIn: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 0 },
    animations: {
      opacity: withTiming(1, { duration: ENTER_MS, easing: EASE_OUT }),
    },
  };
};

const fadeOut: EntryExitAnimationFunction = () => {
  'worklet';
  return {
    initialValues: { opacity: 1 },
    animations: {
      opacity: withTiming(0, { duration: EXIT_MS, easing: EASE_OUT }),
    },
  };
};

/** Wrap a filter row that mounts and unmounts. */
export function FilterPanel({ children }: { children: React.ReactNode }) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? fadeIn : enter}
      exiting={reduced ? fadeOut : exit}
    >
      {children}
    </Animated.View>
  );
}

/** Wrap everything under the filter rows so it follows them smoothly. */
export function ExploreBelowPanels({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: StyleProp<ViewStyle>;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View
      layout={
        reduced
          ? undefined
          : LinearTransition.duration(ENTER_MS).easing(EASE_OUT)
      }
      style={style}
    >
      {children}
    </Animated.View>
  );
}
