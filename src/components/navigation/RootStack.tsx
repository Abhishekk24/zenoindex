/**
 * The session's onboarding stage decides which routes exist:
 *
 *   signedOut → sign-in (email code or wallet)
 *   terms     → terms
 *   profile   → complete-profile
 *   ready     → (tabs): Explore · Portfolio · Profile, search, basket/[id],
 *               position/[id]
 *
 * legal/[doc] and wc-return are open at every stage.
 */
import { Stack } from 'expo-router';
import React from 'react';
import { ActivityIndicator, StyleSheet, View } from 'react-native';

import { useSession } from '../../hooks/useSession';
import { colors } from '../../theme/tokens';

export function RootStack() {
  const { stage, booted } = useSession();
  if (!booted) {
    // /auth/me is still being answered; hold a spinner under the splash.
    return (
      <View style={styles.boot}>
        <ActivityIndicator color={colors.gold} />
      </View>
    );
  }
  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerTintColor: colors.gold,
        headerTitleStyle: { color: colors.text },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.bg },
      }}
    >
      <Stack.Protected guard={stage === 'signedOut'}>
        <Stack.Screen name="sign-in" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'terms'}>
        <Stack.Screen name="terms" options={{ headerShown: false }} />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'profile'}>
        <Stack.Screen
          name="complete-profile"
          options={{ headerShown: false }}
        />
      </Stack.Protected>
      <Stack.Protected guard={stage === 'ready'}>
        <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
        <Stack.Screen
          name="search"
          options={{ headerShown: false, animation: 'fade' }}
        />
        <Stack.Screen
          name="basket/[id]"
          options={{ title: '', headerBackTitle: 'Back' }}
        />
        <Stack.Screen
          name="position/[id]"
          options={{ title: '', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
      {/* Terms / Privacy reader: opened from sign-in and terms, so not tied
          to a stage. After the guarded screens so it is never the fallback. */}
      <Stack.Screen
        name="legal/[doc]"
        options={{
          headerShown: false,
          presentation: 'modal',
          animation: 'slide_from_bottom',
        }}
      />
      {/* Wallet deep-link return: reachable at every stage (wallet sign-in
          happens while signed out). Must stay LAST: when a route is guarded,
          Expo Router falls back to the first allowed screen, and this one
          redirects, so placing it first loops on a blank screen. */}
      <Stack.Screen
        name="wc-return"
        options={{ headerShown: false, animation: 'none' }}
      />
    </Stack>
  );
}

const styles = StyleSheet.create({
  boot: {
    flex: 1,
    backgroundColor: colors.bg,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
