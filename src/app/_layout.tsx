/**
 * Zeno mobile: investor app for on-chain baskets (DTFs) on Robinhood Chain.
 * Providers, fonts and the splash screen; routes live in RootStack.
 */
import {
  SpaceGrotesk_300Light,
  SpaceGrotesk_400Regular,
  SpaceGrotesk_500Medium,
  SpaceGrotesk_600SemiBold,
  SpaceGrotesk_700Bold,
} from '@expo-google-fonts/space-grotesk';
import { PrivyProvider } from '@privy-io/expo';
import { useFonts } from 'expo-font';
import { ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { LogBox, StyleSheet } from 'react-native';
import { GestureHandlerRootView } from 'react-native-gesture-handler';

import { RootStack } from '../components/navigation/RootStack';
import { ModeSwitchOverlay } from '../components/ModeSwitchOverlay';
import { DialogHost } from '../components/ui';
import { OfflineBanner } from '../components/OfflineBanner';
import { WalletPickerHost } from '../components/wallet/WalletPicker';
import { privyProps } from '../config/wallet';
import { SessionProvider } from '../lib/session';
import { navigationTheme } from '../theme/navigationTheme';
import { fonts } from '../theme/tokens';
import { walletConnectProvider } from '../wallets/externalWallet';

// Hold the splash screen until the fonts are ready.
SplashScreen.preventAutoHideAsync();

// Known library noise, kept out of the dev overlay (it still prints to the console):
// - WalletConnect logs lookups of a pairing it already closed (after switching wallets); nothing fails.
// - WalletConnect's relay publisher logs a failed publish it retries by itself (flaky socket, app resumed).
// - Privy's embedded-wallet webview says "ready" again after a reload, when no request is waiting for it.
LogBox.ignoreLogs([
  'Record was recently deleted',
  'core/relayer/publisher',
  'No callback found for "privy:iframe:ready"',
]);

// Start WalletConnect now: it restores a wallet connected in an earlier launch.
void walletConnectProvider().catch(() => {});

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
      <PrivyProvider {...privyProps}>
        <ThemeProvider value={navigationTheme}>
          <SessionProvider>
            <StatusBar style="light" />
            <RootStack />
            <OfflineBanner />
            <ModeSwitchOverlay />
            <DialogHost />
            <WalletPickerHost />
          </SessionProvider>
        </ThemeProvider>
      </PrivyProvider>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
});
