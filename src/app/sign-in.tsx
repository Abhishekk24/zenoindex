/**
 * Sign in with a wallet (design: sign-in mockup).
 *
 * Reown AppKit offers an email wallet (Reown embedded wallet) or any external
 * wallet. Once connected, the wallet signs the server's Sign-In with Ethereum
 * message — a signature only, no transaction. A new wallet gets a new account,
 * which then goes through terms and profile.
 */
import {
  useAccount as useAppKitAccount,
  useAppKit,
  useAppKitState,
} from '@reown/appkit-react-native';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccount, useAccountEffect, useSignMessage } from 'wagmi';

import { LightButton } from '../components/auth/LightButton';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { appKit } from '../config/wallet';
import { useSession } from '../hooks/useSession';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
import { withWalletOpen } from '../lib/walletLink';
import { colors, fonts } from '../theme/tokens';

// Colours specific to the sign-in design.
const CARD_BG = '#000000';

/** Turns wallet/viem errors into something short for the user. */
function walletErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : '';
  if (/reject|denied|cancel/i.test(text)) return 'Signature cancelled.';
  return text || 'Wallet sign-in failed.';
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useSession();
  const { open, disconnect } = useAppKit();
  const { isOpen: pickerOpen } = useAppKitState();
  const appKitAccount = useAppKitAccount();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  // Set when the user taps Continue: once a wallet connects, ask it to sign
  // straight away rather than waiting for a second tap.
  const signInOnConnect = useRef(false);

  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const walletSignIn = async (wallet: string) => {
    setBusy(true);
    setError(undefined);
    try {
      // Reown email wallets can be a smart account, which exists only on some
      // networks (not Robinhood Chain) and can't sign in or trade here. Use the
      // wallet's own account (EOA) instead.
      const active = appKitAccount.allAccounts.find(
        a => a.address.toLowerCase() === wallet.toLowerCase(),
      );
      if (active?.type === 'smartAccount' && appKitAccount.chain) {
        await appKit.switchAccountType('eip155', 'eoa', appKitAccount.chain);
        setError(
          'Switched your email wallet to its standard account. Tap Sign in again.',
        );
        return;
      }
      const challenge = await api.requestWalletLoginChallenge(wallet);
      const signature = await withWalletOpen(() =>
        signMessageAsync({
          account: wallet as `0x${string}`,
          message: challenge.message,
        }),
      );
      setUser(await api.walletLogin({ message: challenge.message, signature }));
    } catch (e) {
      setError(walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseWallet = async () => {
    setError(undefined);
    // With a wallet still connected, open() shows that wallet's account view
    // instead of the picker — disconnect first so another one can be chosen.
    if (isConnected) await disconnect();
    signInOnConnect.current = true;
    open();
  };

  useAccountEffect({
    onConnect({ address: connected }) {
      if (!signInOnConnect.current) return;
      signInOnConnect.current = false;
      void walletSignIn(connected);
    },
  });

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ImageBackground
        source={require('../../assets/images/login-background.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <Image
        source={require('../../assets/images/zeno-logo.png')}
        style={[styles.logo, { top: insets.top + 20 }]}
        accessibilityLabel="Zeno"
      />

      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.scroll,
          { paddingBottom: insets.bottom + 10 },
        ]}
        bounces={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            Continue with your email or a wallet — signing in creates your
            account.
          </Text>

          <View style={styles.actions}>
            {isConnected && address ? (
              <>
                <PrimaryButton
                  label={
                    busy
                      ? 'Check your wallet to sign…'
                      : `Sign in with ${shortAddress(address)}`
                  }
                  onPress={() => walletSignIn(address)}
                  disabled={busy}
                  busy={busy}
                />
                <Pressable
                  onPress={chooseWallet}
                  disabled={busy}
                  accessibilityRole="button"
                  style={styles.linkButton}
                >
                  <Text style={styles.link}>
                    Use a different email or wallet
                  </Text>
                </Pressable>
              </>
            ) : (
              <LightButton
                label={
                  busy
                    ? 'Check your wallet to sign…'
                    : pickerOpen
                      ? 'Choose email or wallet…'
                      : 'Continue with email or wallet'
                }
                onPress={chooseWallet}
                disabled={busy}
              />
            )}
          </View>

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.footer}>
            By continuing you agree to the Terms{'\n'}and Privacy Policy.
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  logo: { position: 'absolute', right: 24, width: 67, height: 18 },
  scroll: {
    flexGrow: 1,
    justifyContent: 'flex-end',
    paddingHorizontal: 10,
  },
  card: {
    backgroundColor: CARD_BG,
    borderRadius: 24,
    paddingHorizontal: 30,
    paddingTop: 32,
    paddingBottom: 28,
  },
  title: {
    fontFamily: fonts.medium,
    fontSize: 22,
    lineHeight: 28,
    color: colors.text,
  },
  subtitle: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.muted,
    marginTop: 6,
  },
  actions: { marginTop: 24, gap: 4 },
  linkButton: { paddingVertical: 10, alignSelf: 'center' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginTop: 14,
  },
  footer: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 20,
    color: colors.muted,
    textAlign: 'center',
    marginTop: 28,
  },
});
