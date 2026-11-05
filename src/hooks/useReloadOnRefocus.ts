import { useFocusEffect } from 'expo-router';
import { useCallback, useRef } from 'react';

/**
 * Reloads when the screen comes back into focus (e.g. back from a trade), so
 * a tab never shows NAV, AUM or positions from before it. The first focus is
 * skipped: the screen's own mount load covers it.
 */
export function useReloadOnRefocus(reload: () => void): void {
  const focusedBefore = useRef(false);
  useFocusEffect(
    useCallback(() => {
      if (focusedBefore.current) reload();
      focusedBefore.current = true;
    }, [reload]),
  );
}
