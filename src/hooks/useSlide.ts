import { useEffect, useRef } from 'react';
import {
  Easing,
  useReducedMotion,
  useSharedValue,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';

/**
 * Slides an indicator to the `index`-th of equal-width tabs, `segment` wide.
 * Starts in place on first layout; moves instantly with reduced motion.
 */
export function useSlide(index: number, segment: number): SharedValue<number> {
  const x = useSharedValue(0);
  const placed = useRef(false);
  const reduceMotion = useReducedMotion();
  useEffect(() => {
    if (!segment) return;
    const target = index * segment;
    if (!placed.current || reduceMotion) {
      placed.current = true;
      x.set(target);
    } else {
      x.set(
        withTiming(target, { duration: 260, easing: Easing.out(Easing.cubic) }),
      );
    }
  }, [index, segment, reduceMotion, x]);
  return x;
}
