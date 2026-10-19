/**
 * Sign in with email, Google or a wallet (design: sign-in mockup) — all three
 * through Privy, so every user is a Privy user.
 *
 * - Email: Send code → "Check your email" step (EmailCodeStep) → Privy checks
 *   the code. Google: Privy's OAuth page, returning via the app's scheme.
 *   Privy then creates the user's embedded wallet.
 * - Connect wallet: AppKit's picker connects an external wallet (MetaMask &
 *   co.), which signs Privy's Sign-In with Ethereum message — a signature
 *   only, no transaction.
 *
 * The backend then exchanges Privy's access token for a Zeno session on the
 * user's wallet (POST /auth/privy). A new wallet gets a new account, which then
 * goes through terms and profile.
 */
import {
  useEmbeddedEthereumWallet,
  useLoginWithEmail,
  useLoginWithOAuth,
  useLoginWithSiwe,
  usePrivy,
} from '@privy-io/expo';
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
import { getAddress } from 'viem';
import { mainnet } from 'viem/chains';
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
import { SIWE_ORIGIN } from '../config/wallet';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
import { signsWithExternalWallet } from '../lib/wallet';
import { withWalletOpen } from '../lib/walletLink';
import { colors, fonts } from '../theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SIGN_TIMEOUT_MS = 2 * 60_000;
const SIGN_TIMEOUT =
  'No answer from your wallet. Connect your wallet again and retry.';

/** Turns wallet/viem errors into something short for the user. */
function walletErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : '';
  if (/reject|denied|cancel/i.test(text)) return 'Signature cancelled.';
  return text || 'Wallet sign-in failed.';
}

/** Turns Privy/API errors into something short for the user. */
function signInErrorMessage(e: unknown): string {
  const text = e instanceof Error ? e.message : '';
  if (/cancel/i.test(text)) return 'Sign-in cancelled.';
  return text || 'Sign-in failed. Please try again.';
}

/** Privy's code errors → the code step's error line; null if not about the code. */
function codeErrorOf(e: unknown): CodeError | null {
  const text = e instanceof Error ? e.message : '';
  if (/too many|attempts|locked/i.test(text)) return { kind: 'locked' };
  if (/expired/i.test(text)) return { kind: 'expired' };
  if (/code|otp|incorrect|invalid/i.test(text)) return { kind: 'invalid' };
  return null;
}

export default function SignInScreen() {
  const insets = useSafeAreaInsets();
  const { setUser } = useSession();
  const keyboardHeight = useKeyboardHeight();
  const privy = usePrivy();
  const { wallets } = useEmbeddedEthereumWallet();
  const { sendCode: sendPrivyCode, loginWithCode } = useLoginWithEmail();
  const { login: loginWithOAuth } = useLoginWithOAuth();
  const { generateSiweMessage, loginWithSiwe } = useLoginWithSiwe();
  const { open, disconnect } = useAppKit();
  const { isOpen: pickerOpen } = useAppKitState();
  const { address, isConnected } = useAppKitAccount();
  const { signMessageAsync } = useSignMessage();
  // Set when the user starts a sign-in: once a wallet connects, ask it to sign
  // straight away rather than waiting for a second tap.
  const signInOnConnect = useRef(false);
  // Only offer "Sign in with 0x…" for a wallet connected on this screen: a
  // connection restored from an earlier run may be dead on the wallet's side,
  // and its signature request would never arrive.
  const [connectedHere, setConnectedHere] = useState(false);

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [codeError, setCodeError] = useState<CodeError>();
  const [codeBusy, setCodeBusy] = useState<'verify' | 'resend'>();
  // Bumped per code sent so EmailCodeStep restarts its resend countdown.
  const [codeKey, setCodeKey] = useState(0);
  // The Zeno session exchange failed (e.g. backend unreachable). Privy's sign-in
  // stays valid — its email code is already used up — so retry the exchange
  // rather than sending the user back to enter a code that no longer works.
  const [exchangeFailed, setExchangeFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);

  const validEmail = EMAIL.test(email.trim());
  const walletAddress = wallets[0]?.address;

  // Signed in to Privy (just now, or left from an earlier run when only the
  // Zeno session expired): waiting for the wallet, then the Zeno session.
  // Privy refuses a second login, so this never shows the form.
  const finishing = privy.isReady && Boolean(privy.user);
  // Wallet sign-ins have their wallet already; email / Google users' embedded
  // wallet appears shortly after login (createOnLogin), and the backend looks
  // it up on the Privy user, so wait for it before exchanging.
  const accountWallet = signsWithExternalWallet(privy.user)
    ? 'external'
    : walletAddress;

  useEffect(() => {
    if (!finishing || !accountWallet) return;
    let live = true;
    (async () => {
      try {
        const token = await privy.getAccessToken();
        if (!token) throw new Error('Sign-in expired. Please try again.');
        const user = await api.privyLogin(token);
        if (live) setUser(user);
      } catch (e) {
        if (!live) return;
        setError(signInErrorMessage(e));
        setExchangeFailed(true);
      }
    })();
    return () => {
      live = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- once per wallet / retry
  }, [finishing, accountWallet, attempt]);

  const retryExchange = () => {
    setError(undefined);
    setExchangeFailed(false);
    setAttempt(n => n + 1);
  };

  /** Drops the Privy sign-in so the user can start over with a fresh code or wallet. */
  const startOver = async () => {
    setError(undefined);
    setExchangeFailed(false);
    setCodeError(undefined);
    setStep('email');
    await privy.logout().catch(() => {});
  };

  const sendCode = async () => {
    setBusy(true);
    setError(undefined);
    setCodeError(undefined);
    try {
      await sendPrivyCode({ email: email.trim() });
      setCodeKey(k => k + 1);
      setStep('code');
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  // On success Privy's user appears and `finishing` takes over.
  const verifyEmailCode = async (code: string) => {
    setCodeBusy('verify');
    setError(undefined);
    setCodeError(undefined);
    try {
      await loginWithCode({ code, email: email.trim() });
    } catch (e) {
      const codeErr = codeErrorOf(e);
      if (codeErr) setCodeError(codeErr);
      else setError(signInErrorMessage(e));
    } finally {
      setCodeBusy(undefined);
    }
  };

  const resendEmailCode = async () => {
    setCodeBusy('resend');
    setError(undefined);
    setCodeError(undefined);
    try {
      await sendPrivyCode({ email: email.trim() });
      setCodeKey(k => k + 1);
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setCodeBusy(undefined);
    }
  };

  const googleSignIn = async () => {
    setBusy(true);
    setError(undefined);
    try {
      await loginWithOAuth({ provider: 'google' });
    } catch (e) {
      setError(signInErrorMessage(e));
    } finally {
      setBusy(false);
    }
  };

  const walletSignIn = async (wallet: string) => {
    setBusy(true);
    setError(undefined);
    try {
      // Privy's SIWE message for this wallet; Privy checks the signature.
      // Always Ethereum (see config/wallet.ts): the wallet's current chain may
      // be Robinhood, which Privy can't verify a signature on.
      const message = await generateSiweMessage({
        from: SIWE_ORIGIN,
        wallet: {
          chainId: `eip155:${mainnet.id}`,
          address: getAddress(wallet),
        },
      });
      let timer: ReturnType<typeof setTimeout> | undefined;
      const signature = await Promise.race([
        withWalletOpen(() =>
          signMessageAsync({ account: wallet as `0x${string}`, message }),
        ),
        // A wallet that lost this session never answers; don't wait forever.
        new Promise<never>((_, reject) => {
          timer = setTimeout(
            () => reject(new Error(SIGN_TIMEOUT)),
            SIGN_TIMEOUT_MS,
          );
        }),
      ]).finally(() => clearTimeout(timer));
      // Signed in to Privy: `finishing` takes over and opens the Zeno session.
      // Privy otherwise checks against the last message it generated, which a
      // second attempt (re-tap, reconnect) may have replaced.
      await loginWithSiwe({ signature, messageOverride: message });
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
          {finishing ? (
            <>
              <Text style={styles.title}>Sign in</Text>
              <View style={styles.connected}>
                {exchangeFailed ? (
                  <>
                    <PrimaryButton label="Try again" onPress={retryExchange} />
                    <Pressable
                      onPress={startOver}
                      accessibilityRole="button"
                      style={styles.linkButton}
                    >
                      <Text style={styles.link}>Use a different account</Text>
                    </Pressable>
                  </>
                ) : (
                  <PrimaryButton
                    label="Signing you in…"
                    onPress={() => {}}
                    disabled
                    busy
                  />
                )}
              </View>
            </>
          ) : step === 'code' ? (
            <EmailCodeStep
              key={codeKey}
              email={email.trim()}
              error={codeError}
              busy={codeBusy}
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
                onSubmitEditing={() => validEmail && !busy && sendCode()}
                style={styles.input}
              />
              <PrimaryButton
                label="Send code"
                onPress={sendCode}
                disabled={!validEmail || busy || pickerOpen}
                busy={busy}
              />
              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>
              <LightButton
                label="Continue with Google"
                icon={<GoogleIcon />}
                onPress={googleSignIn}
                disabled={busy || pickerOpen}
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
                    disabled={busy}
                  />
                  <Pressable
                    onPress={chooseWallet}
                    disabled={busy}
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
                  disabled={busy}
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
  connected: { marginTop: 12 },
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
