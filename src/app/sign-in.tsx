/**
 * Sign in with email, Google or a wallet (design: sign-in mockup).
 *
 * Email and Google go through Reown's embedded wallet, finished in the in-app
 * browser (lib/socialLogin.ts); Connect wallet opens AppKit's wallet picker. Once
 * connected, the wallet signs the server's Sign-In with Ethereum message — a
 * signature only, no transaction. A new wallet gets a new account, which then
 * goes through terms and profile.
 */
import {
  useAccount as useAppKitAccount,
  useAppKit,
  useAppKitState,
} from '@reown/appkit-react-native';
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useRef, useState } from 'react';
import {
  Image,
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAccountEffect, useSignMessage } from 'wagmi';

import { LightButton } from '../components/auth/LightButton';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { GoogleIcon } from '../components/icons';
import { appKit } from '../config/wallet';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
import {
  connectWithSocial,
  SocialLoginCancelled,
  type SocialProvider,
} from '../lib/socialLogin';
import { withWalletOpen } from '../lib/walletLink';
import { colors, fonts } from '../theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

// Colours specific to the sign-in design.
const CARD_BG = '#000000';
const INPUT_BG = '#08150f';
const INPUT_BORDER = 'rgba(92, 199, 150, 0.28)';
const DIVIDER = 'rgba(92, 199, 150, 0.22)';

/** Turns wallet/viem errors into something short for the user. */
function walletErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : '';
  if (/reject|denied|cancel/i.test(text)) return 'Signature cancelled.';
  return text || 'Wallet sign-in failed.';
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useSession();
  const keyboardHeight = useKeyboardHeight();
  const { open, disconnect } = useAppKit();
  const { isOpen: pickerOpen } = useAppKitState();
  // AppKit's active address, not wagmi's: for Reown email wallets wagmi reports
  // the session's first account — the smart account, which can't be used here —
  // while AppKit resolves the wallet's own account (EOA).
  const appKitAccount = useAppKitAccount();
  const { address, isConnected } = appKitAccount;
  const { signMessageAsync } = useSignMessage();
  // Set when the user starts a sign-in: once a wallet connects, ask it to sign
  // straight away rather than waiting for a second tap.
  const signInOnConnect = useRef(false);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Email/Google login is open in the browser.
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();

  const validEmail = EMAIL.test(email.trim());

  const walletSignIn = async (connected: string) => {
    const wallet = appKitAccount.address ?? connected;
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

  /**
   * Email or Google via Reown's embedded wallet, finished in the in-app
   * browser. Reown asks for the email there; it can't be handed it.
   */
  const socialSignIn = async (provider: SocialProvider) => {
    setError(undefined);
    if (isConnected) await disconnect();
    signInOnConnect.current = true;
    setConnecting(true);
    try {
      await connectWithSocial(provider);
    } catch (e) {
      signInOnConnect.current = false;
      setError(
        e instanceof SocialLoginCancelled
          ? e.message
          : 'Sign-in could not start. Please try again.',
      );
    } finally {
      setConnecting(false);
    }
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
          {
            paddingBottom:
              keyboardHeight > 0 ? keyboardHeight + 10 : insets.bottom + 10,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View style={styles.card}>
          <Text style={styles.title}>Sign in</Text>
          <Text style={styles.subtitle}>
            No account needed — signing in creates one.
          </Text>

          {isConnected && address ? (
            <View style={styles.connected}>
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
                <Text style={styles.link}>Use a different email or wallet</Text>
              </Pressable>
            </View>
          ) : (
            <>
              <Text style={styles.label}>EMAIL ADDRESS</Text>
              <TextInput
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                placeholderTextColor={colors.dim}
                selectionColor={colors.green}
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() =>
                  validEmail && !connecting && socialSignIn('email')
                }
                style={styles.input}
              />
              <PrimaryButton
                label={busy ? 'Check your wallet to sign…' : 'Send code'}
                onPress={() => socialSignIn('email')}
                disabled={!validEmail || busy || connecting || pickerOpen}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <LightButton
                label="Continue with Google"
                icon={<GoogleIcon />}
                onPress={() => socialSignIn('google')}
                disabled={busy || connecting || pickerOpen}
              />
              <LightButton
                label={pickerOpen ? 'Choose a wallet…' : 'Connect wallet'}
                onPress={chooseWallet}
                disabled={busy || connecting}
              />
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.footer}>
            By continuing you agree to the{' '}
            <Text
              style={styles.footerLink}
              onPress={() =>
                router.push({
                  pathname: '/legal/[doc]',
                  params: { doc: 'terms' },
                })
              }
            >
              Terms
            </Text>
            {'\n'}and{' '}
            <Text
              style={styles.footerLink}
              onPress={() =>
                router.push({
                  pathname: '/legal/[doc]',
                  params: { doc: 'privacy' },
                })
              }
            >
              Privacy Policy
            </Text>
            .
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
  connected: { marginTop: 12 },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.muted,
    marginTop: 22,
    marginBottom: 8,
  },
  input: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 30,
    marginBottom: 6,
  },
  dividerLine: { flex: 1, height: 1, backgroundColor: DIVIDER },
  dividerText: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.muted,
  },
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
  footerLink: {
    fontFamily: fonts.medium,
    color: colors.text,
    textDecorationLine: 'underline',
  },
});
