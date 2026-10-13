import { useNetInfo } from '@react-native-community/netinfo';
import React from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, space } from '../theme/tokens';

/**
 * A strip under the status bar while the phone has no internet. Prices,
 * balances and trades all need the network, so say so before a request fails.
 */
export function OfflineBanner() {
  const { isConnected, isInternetReachable } = useNetInfo();
  const insets = useSafeAreaInsets();
  // `null` means not known yet; only show once the phone says it's offline.
  const offline = isConnected === false || isInternetReachable === false;
  if (!offline) return null;
  return (
    <View
      style={[styles.banner, { paddingTop: insets.top + space.xs }]}
      pointerEvents="none"
      accessibilityRole="alert"
      accessibilityLiveRegion="polite"
    >
      <Text style={styles.text}>
        You’re offline. Prices and balances may be out of date.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    backgroundColor: colors.surface3,
    borderBottomWidth: 1,
    borderBottomColor: colors.goldLine,
    paddingBottom: space.sm,
    paddingHorizontal: space.lg,
  },
  text: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.gold,
    textAlign: 'center',
  },
});
