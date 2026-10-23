/**
 * The session's onboarding stage decides which routes exist:
 *
 *   signedOut → sign-in (email code, Google or wallet)
 *   terms,
 *   profile   → complete-profile (agree to the terms and fill in the profile,
 *               one screen)
 *   ready     → (tabs): Explore · Portfolio · Profile, search, basket/[id],
 *               position/[id], edit-profile, manager/* (manager mode)
 *
 * legal/[doc] and wc-return are open at every stage.
 */
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import React, { useEffect } from 'react';

import { useSession } from '../../hooks/useSession';
import { colors } from '../../theme/tokens';

export function RootStack() {
  const { stage, booted } = useSession();
  // The splash stays up until /auth/me says where to go (fonts are loaded by
  // now, see _layout), then the right screen shows straight away: no
  // spinner in between. /auth/me gives up after 20 s (lib/http).
  useEffect(() => {
    if (booted) void SplashScreen.hideAsync();
  }, [booted]);
  if (!booted) return null;
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
      <Stack.Protected guard={stage === 'terms' || stage === 'profile'}>
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
        <Stack.Screen name="activity/[id]" options={{ headerShown: false }} />
        <Stack.Screen name="manager/create" options={{ headerShown: false }} />
        <Stack.Screen
          name="manager/[id]/corporate-actions"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="manager/[id]/fees"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="manager/[id]/rebalance"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="manager/[id]/liquidity"
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="edit-profile"
          options={{
            headerShown: false,
            presentation: 'modal',
            animation: 'slide_from_bottom',
          }}
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
