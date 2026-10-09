/**
 * Zeno mobile: investor app for on-chain baskets (DTFs) on Robinhood Chain.
 * Providers, fonts and the splash screen; routes live in RootStack.
 */
// WalletConnect polyfills (crypto.getRandomValues, TextEncoder, URL, Buffer)
// must load before any AppKit/WalletConnect module, so this stays first.
import '@walletconnect/react-native-compat';

import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { AppKit, AppKitProvider } from '@reown/appkit-react-native';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { useFonts } from 'expo-font';
import { ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { WagmiProvider } from 'wagmi';

import { RootStack } from '../components/navigation/RootStack';
import { appKit, wagmiAdapter } from '../config/wallet';
import { SessionProvider } from '../lib/session';
import { navigationTheme } from '../theme/navigationTheme';
import { fonts } from '../theme/tokens';

// Hold the splash screen until the fonts are ready.
SplashScreen.preventAutoHideAsync();

const queryClient = new QueryClient();

export default function RootLayout() {
  // Loaded at runtime so they also work in Expo Go. The keys are the family
  // names used in theme/tokens.ts.
  const [loaded, error] = useFonts({
    [fonts.light]: SpaceGrotesk_300Light,
    [fonts.regular]: SpaceGrotesk_400Regular,
    [fonts.medium]: SpaceGrotesk_500Medium,
    [fonts.semibold]: SpaceGrotesk_600SemiBold,
    [fonts.bold]: SpaceGrotesk_700Bold,
  });

  useEffect(() => {
    if (loaded || error) SplashScreen.hideAsync();
  }, [loaded, error]);

  // If a font fails to load, carry on with system fonts rather than block.
  if (!loaded && !error) return null;

  return (
    <GestureHandlerRootView style={styles.root}>
      {/* Order from the Reown docs: AppKitProvider → WagmiProvider →
          QueryClientProvider. */}
      <AppKitProvider instance={appKit}>
        <WagmiProvider config={wagmiAdapter.wagmiConfig}>
          <QueryClientProvider client={queryClient}>
            <ThemeProvider value={navigationTheme}>
              <SessionProvider>
                <StatusBar style="light" />
                <RootStack />
              </SessionProvider>
            </ThemeProvider>
            {/* The wallet picker. AppKitProvider only holds state; without
                this the picker never appears. Wrapped in a full-screen
                absolute layer (Reown docs, Expo Android) that lets touches
                through to the app while the picker is closed. */}
            <View style={styles.appKit} pointerEvents="box-none">
              <AppKit />
            </View>
          </QueryClientProvider>
        </WagmiProvider>
      </AppKitProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  appKit: { ...StyleSheet.absoluteFill },
});
