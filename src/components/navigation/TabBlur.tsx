/**
 * What the tab bar blurs on Android. Android has no system "blur what's
 * behind" (iOS does): expo-blur copies a BlurTargetView's content and blurs
 * it, and the BlurView can't sit inside its own target. So each tab screen is
 * its own target (TabBlurTarget, the tabs' screenLayout) and the bar blurs the
 * focused one (useTabBlurTarget).
 */
import { BlurTargetView } from 'expo-blur';
import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { StyleSheet, View } from 'react-native';

type Target = { key: string; ref: React.RefObject<React.ComponentRef<typeof View> | null> };

let focused: Target | null = null;
const listeners = new Set<() => void>();
const setFocused = (target: Target | null) => {
  focused = target;
  listeners.forEach(l => l());
};

/** The focused tab screen's blur target, for the tab bar's BlurView. */
export function useTabBlurTarget(): Target | null {
  return useSyncExternalStore(
    l => (listeners.add(l), () => listeners.delete(l)),
    () => focused,
  );
}

type FocusNavigation = {
  isFocused(): boolean;
  addListener(type: 'focus', callback: () => void): () => void;
};

/** Wraps one tab screen so the tab bar can blur it while it's focused. */
export function TabBlurTarget({
  routeKey,
  navigation,
  children,
}: {
  routeKey: string;
  navigation: FocusNavigation;
  children: React.ReactNode;
}) {
  const ref = useRef<React.ComponentRef<typeof View> | null>(null);
  useEffect(() => {
    const target = { key: routeKey, ref };
    if (navigation.isFocused()) setFocused(target);
    const unsubscribe = navigation.addListener('focus', () =>
      setFocused(target),
    );
    return () => {
      unsubscribe();
      if (focused?.key === routeKey) setFocused(null);
    };
  }, [routeKey, navigation]);

  return (
    <BlurTargetView ref={ref} style={styles.fill}>
      {children}
    </BlurTargetView>
  );
}

const styles = StyleSheet.create({ fill: { flex: 1 } });
