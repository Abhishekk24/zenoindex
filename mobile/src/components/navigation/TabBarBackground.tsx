import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';

import { useTabBlurTarget } from './TabBlur';

/**
 * Frosted tab bar: the content scrolls underneath it, blurred. iOS blurs
 * whatever is behind; Android blurs the focused tab screen (TabBlur), on
 * Android 12+ — older versions show the tint only (expo-blur's choice, for
 * performance).
 */
export function TabBarBackground() {
  const target = useTabBlurTarget();
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        // A new target (tab change) needs a new native blur view.
        key={target?.key ?? 'none'}
        tint="dark"
        intensity={50}
        // No target yet (first frame): the tint alone, not a blur of nothing.
        blurMethod={target ? 'dimezisBlurViewSdk31Plus' : 'none'}
        blurTarget={target?.ref}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.tint} />
    </View>
  );
}

const styles = StyleSheet.create({
  // A light dark wash so labels stay readable without hiding the blur.
  tint: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(5, 7, 6, 0.4)',
  },
});
