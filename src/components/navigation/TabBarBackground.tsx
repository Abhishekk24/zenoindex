import { BlurView } from 'expo-blur';
import React from 'react';
import { StyleSheet, View } from 'react-native';

/** Frosted tab bar: the content scrolls underneath it, blurred. */
export function TabBarBackground() {
  return (
    <View style={StyleSheet.absoluteFill}>
      <BlurView
        tint="dark"
        intensity={50}
        // shortcut: iOS-only blur; Android shows the tint (its blur needs a `blurTarget` wrapping the screens), add it if Android blur is wanted.
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
