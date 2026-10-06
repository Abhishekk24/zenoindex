/**
 * Zeno mobile: investor app for on-chain baskets (DTFs) on Robinhood Chain.
 * Screens run on development sample data (src/lib/data.ts) until the app is
 * connected to the web app's /api/v1.
 *
 * The session's onboarding stage decides which routes exist:
 *
 *   signedOut → sign-in (email, then the 6-digit code)
 *   terms     → terms
 *   profile   → complete-profile
 *   ready     → (tabs): Explore · Portfolio · Profile, and basket/[id]
 */
import { AppKitProvider } from '@reown/appkit-react-native';
import { useFonts } from 'expo-font';
import { DarkTheme, Stack, Theme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';

import { appKit } from '../config/wallet';
import { SessionProvider, useSession } from '../lib/session';
import { colors, fonts } from '../theme/tokens';

// Hold the splash screen until the fonts are ready.
SplashScreen.preventAutoHideAsync();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.line,
    notification: colors.gold,
  },
  // Headers use `bold`, tab labels `medium`. The weight is in the family, so
  // fontWeight stays normal (see fonts in theme/tokens.ts).
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
    bold: { fontFamily: fonts.semibold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
  },
};

export default function RootLayout() {
  // Loaded at runtime (not embedded by the config plugin) so they also work in
  // Expo Go. The keys are the family names used in theme/tokens.ts.
  const [loaded, error] = useFonts({
    [fonts.regular]: require('../../assets/fonts/Inter-Regular.ttf'),
    [fonts.medium]: require('../../assets/fonts/Inter-Medium.ttf'),
    [fonts.semibold]: require('../../assets/fonts/Inter-SemiBold.ttf'),
    [fonts.bold]: require('../../assets/fonts/Inter-Bold.ttf'),
    [fonts.serif]: require('../../assets/fonts/PlayfairDisplay-Italic.ttf'),
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // If a font fails to load, carry on with system fonts rather than block.
  if (!loaded && !error) return null;

  return (
  <ThemeProvider value={theme}>
    <AppKitProvider instance={appKit}>
      <SessionProvider>
        <StatusBar style="light" />
        <RootStack />
      </SessionProvider>
    </AppKitProvider>
  </ThemeProvider>
);
}

function RootStack() {
  const { stage } = useSession();
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
          name="basket/[id]"
          options={{ title: '', headerBackTitle: 'Back' }}
        />
      </Stack.Protected>
    </Stack>
  );
}
