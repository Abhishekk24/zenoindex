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
import React, { useEffect, useRef, useState } from 'react';
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

import {
  type CodeError,
  EmailCodeStep,
} from '../components/auth/EmailCodeStep';
import { LightButton } from '../components/auth/LightButton';
import {
  CARD_BG,
  DIVIDER,
  INPUT_BG,
  INPUT_BORDER,
} from '../components/auth/palette';
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

/**
 * Zeno's own email codes (Send code → "Check your email" step). Off until the
 * API has email-code endpoints; while off, Send code uses Reown's email login.
 * TODO(backend): send / verify / resend endpoints, then turn this on and fill
 * in sendEmailCode, verifyEmailCode and resendEmailCode below.
 */
const EMAIL_CODES_ENABLED = false;

const SIGN_TIMEOUT_MS = 2 * 60_000;
const SIGN_TIMEOUT =
  'No answer from your wallet. Connect your wallet again and retry.';

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
  const signInAfterSwitch = useRef(false);
  // Only offer "Sign in with 0x…" for a wallet connected on this screen: a
  // connection restored from an earlier run may be dead on the wallet's side,
  // and its signature request would never arrive.
  const [connectedHere, setConnectedHere] = useState(false);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  // Email/Google login is open in the browser.
  const [connecting, setConnecting] = useState(false);
  const [error, setError] = useState<string>();
  // Zeno email codes (EMAIL_CODES_ENABLED).
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [codeError, setCodeError] = useState<CodeError>();

  const validEmail = EMAIL.test(email.trim());

  // TODO(backend): request a code for `email`; show the server's resend
  // cooldown via EmailCodeStep's resendAfterSeconds.
  const sendEmailCode = () => {
    setError(undefined);
    setCodeError(undefined);
    setStep('code');
  };
  // TODO(backend): verify; on failure map the server's error to a CodeError,
  // e.g. code_expired → { kind: 'expired', triesLeft }.
  const verifyEmailCode = (_code: string) => {};
  // TODO(backend): request a new code.
  const resendEmailCode = () => setCodeError(undefined);

  const sendCode = () =>
    EMAIL_CODES_ENABLED ? sendEmailCode() : socialSignIn('email');

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
      // The switch is local (no wallet round trip); the effect below signs
      // in as soon as AppKit reports the EOA, so the user taps only once.
      if (active?.type === 'smartAccount' && appKitAccount.chain) {
        signInAfterSwitch.current = true;
        await appKit.switchAccountType('eip155', 'eoa', appKitAccount.chain);
        return;
      }
      const challenge = await api.requestWalletLoginChallenge(wallet);
      let timer: ReturnType<typeof setTimeout> | undefined;
      const signature = await Promise.race([
        withWalletOpen(() =>
          signMessageAsync({
            account: wallet as `0x${string}`,
            message: challenge.message,
          }),
        ),
        // A wallet that lost this session never answers; don't wait forever.
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(SIGN_TIMEOUT)),
            SIGN_TIMEOUT_MS,
          );
        }),
      ]).finally(() => clearTimeout(timer));
      setUser(await api.walletLogin({ message: challenge.message, signature }));
    } catch (e) {
      // No answer: drop the connection so the next try starts a fresh one.
      if (e instanceof Error && e.message === SIGN_TIMEOUT) await disconnect();
      setError(walletErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const chooseWallet = async () => {
    setError(undefined);
    setConnectedHere(true);
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
    setConnectedHere(true);
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

  useEffect(() => {
    if (!signInAfterSwitch.current || !address) return;
    signInAfterSwitch.current = false;
    void walletSignIn(address);
    // eslint-disable-next-line react-hooks/exhaustive-deps -- runs once per account switch
  }, [address]);

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
          {step === 'code' ? (
            <EmailCodeStep
              email={email.trim()}
              error={codeError}
              onVerify={verifyEmailCode}
              onResend={resendEmailCode}
              onChangeEmail={() => {
                setCodeError(undefined);
                setStep('email');
              }}
            />
          ) : (
            <>
              <Text style={styles.title}>Sign in</Text>
              <Text style={styles.subtitle}>
                No account needed — signing in creates one.
              </Text>

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
                onSubmitEditing={() => validEmail && !connecting && sendCode()}
                style={styles.input}
              />
              <PrimaryButton
                label="Send code"
                onPress={sendCode}
                disabled={!validEmail || busy || connecting || pickerOpen}
                busy={connecting}
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
              {isConnected && address && connectedHere ? (
                <>
                  <LightButton
                    label={
                      busy
                        ? 'Check your wallet to sign…'
                        : `Sign in with ${shortAddress(address)}`
                    }
                    onPress={() => walletSignIn(address)}
                    disabled={busy || connecting}
                  />
                  <Pressable
                    onPress={chooseWallet}
                    disabled={busy || connecting}
                    accessibilityRole="button"
                    style={styles.linkButton}
                  >
                    <Text style={styles.link}>Use a different wallet</Text>
                  </Pressable>
                </>
              ) : (
                <LightButton
                  label={
                    busy
                      ? 'Check your wallet to sign…'
                      : pickerOpen
                        ? 'Choose a wallet…'
                        : 'Connect wallet'
                  }
                  onPress={chooseWallet}
                  disabled={busy || connecting}
                />
              )}
            </>
          )}

          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.footer}>
            {/* Terms and Privacy Policy open the in-app reader (legal/[doc]). */}
            By continuing you agree to the{' '}
            <Text
              style={styles.footerLink}
              accessibilityRole="link"
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
              accessibilityRole="link"
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
