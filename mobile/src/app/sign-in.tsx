/**
 * Sign in with email, Google or a wallet (design: sign-in mockup) — all three
 * through Privy, so every user is a Privy user.
 *
 * - Email: Send code → "Check your email" step (EmailCodeStep) → Privy checks
 *   the code. Google: Privy's OAuth page, returning via the app's scheme.
 *   Privy then creates the user's embedded wallet.
 * - Connect wallet: our wallet picker (components/wallet/WalletPicker)
 *   connects an external wallet over WalletConnect (MetaMask, Rainbow, … any
 *   WalletConnect wallet), which signs Privy's Sign-In with Ethereum message — a signature
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
import { StatusBar } from 'expo-status-bar';
import React, { useEffect, useState } from 'react';
import {
  ImageBackground,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getAddress, type Hex } from 'viem';
import { mainnet } from 'viem/chains';

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
import { Notice, type NoticeContent } from '../components/ui';
import { chooseWallet as openWalletPicker } from '../components/wallet/WalletPicker';
import { SIWE_ORIGIN } from '../config/wallet';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
import { signsWithExternalWallet } from '../lib/wallet';
import { colors, fonts } from '../theme/tokens';
import {
  cancelWalletRequest,
  externalWallet as currentExternalWallet,
  openWalletApp,
  signMessage,
  switchChain,
  useExternalWallet,
  walletName,
  WalletError,
  walletTrace,
  warmUp,
} from '../wallets/externalWallet';

/** Before "Resend code" shows on the code step (design: "Resend in 0:42"). */
const RESEND_AFTER_SECONDS = 60;

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** "your wallet" → "Your wallet"; "MetaMask" unchanged. */
const capitalized = (text: string) =>
  text.charAt(0).toUpperCase() + text.slice(1);

/**
 * Wallet sign-in, step by step (after the wallet is connected):
 * - switch: the wallet moves to Ethereum, which Privy checks the signature
 *   on (a wallet already there answers without a prompt).
 * - message: Privy writes the sign-in message (< 1 s).
 * - sign: the user signs it in the wallet (user's tap).
 * - verify: Privy checks the signature (< 2 s).
 * Then `finishing` opens the Zeno session (POST /auth/privy, < 2 s).
 * Wallet steps give up after 2 min (wallets/externalWallet.ts), Privy's after
 * PRIVY_TIMEOUT_MS, the backend's after 20 s (lib/http.ts).
 */
type WalletStep = 'switch' | 'message' | 'sign' | 'verify';

const PRIVY_TIMEOUT_MS = 30_000;
const PRIVY_TIMEOUT =
  'Privy didn’t respond. Check your connection and try again.';

/** Rejects with `message` if `work` takes longer than `ms`. */
function withTimeout<T>(work: Promise<T>, ms: number, message: string) {
  let timer: ReturnType<typeof setTimeout> | undefined;
  return Promise.race([
    work,
    new Promise<never>((_, reject) => {
      timer = setTimeout(() => reject(new Error(message)), ms);
    }),
  ]).finally(() => clearTimeout(timer));
}

/** Turns wallet/viem errors into something short for the user. */
function walletErrorMessage(e: unknown): string {
  // Wallet errors already say what happened and in which app.
  if (e instanceof WalletError) return e.message;
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
  // The external wallet (WalletConnect): one source of truth for its address.
  const externalWallet = useExternalWallet();
  const address =
    externalWallet.status === 'connected' ? externalWallet.address : undefined;
  const isConnected = address !== undefined;
  const pickerOpen = externalWallet.status === 'connecting';
  // The connection made on this screen. "Sign in with 0x…" (a retry) only
  // signs over that one: an older connection may be gone on the wallet's
  // side, and its signature request would never be shown.
  const [connectedTopic, setConnectedTopic] = useState<string>();

  const [email, setEmail] = useState('');
  const [busy, setBusy] = useState(false);
  const [walletStep, setWalletStep] = useState<WalletStep>();
  // What went wrong with the wallet, and what the user can do next.
  const [notice, setNotice] = useState<NoticeContent>();
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

  // Opens the WalletConnect relay now, so a wallet opens at once when picked
  // (opening it on demand cost ~2.4 s on device).
  useEffect(() => {
    void warmUp();
  }, []);

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
        walletTrace('Zeno: opening the session');
        const token = await privy.getAccessToken();
        if (!token) throw new Error('Sign-in expired. Please try again.');
        const user = await api.privyLogin(token);
        walletTrace('Zeno: signed in');
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
    setNotice(undefined);
    try {
      // Sign-in is on Ethereum: the SIWE message says chain 1, and Privy can't
      // check a signature made on another chain (Robinhood after trading) —
      // smart-account wallets sign per network (Fahmin, ebb742d). Always
      // asked: the network known from connecting may not be the wallet's.
      setWalletStep('switch');
      try {
        await switchChain(mainnet.id, { always: true });
      } catch (e) {
        if (e instanceof WalletError && e.kind === 'rejected') {
          setNotice({
            tone: 'error',
            title: 'Network switch declined',
            message: `Zeno signs you in on Ethereum. It doesn’t move any funds or change where you trade.`,
            actions: [
              {
                label: 'Try again',
                onPress: () => void walletSignIn(wallet),
              },
            ],
          });
          return;
        }
        throw e;
      }

      // Privy's SIWE message for this wallet; Privy checks the signature.
      setWalletStep('message');
      walletTrace('Privy: getting the sign-in message');
      const message = await withTimeout(
        generateSiweMessage({
          from: SIWE_ORIGIN,
          wallet: {
            chainId: `eip155:${mainnet.id}`,
            address: getAddress(wallet),
          },
        }),
        PRIVY_TIMEOUT_MS,
        PRIVY_TIMEOUT,
      );
      setWalletStep('sign');
      const signature = await signMessage(message, getAddress(wallet) as Hex);
      setWalletStep('verify');
      walletTrace('Privy: checking the signature');
      // Signed in to Privy: `finishing` takes over and opens the Zeno session.
      // Privy otherwise checks against the last message it generated, which a
      // second attempt (re-tap, reconnect) may have replaced.
      await withTimeout(
        loginWithSiwe({ signature, messageOverride: message }),
        PRIVY_TIMEOUT_MS,
        PRIVY_TIMEOUT,
      );
      walletTrace('Privy: signed in, opening the Zeno session');
    } catch (e) {
      setNotice(signInNotice(e, wallet));
    } finally {
      setBusy(false);
      setWalletStep(undefined);
    }
  };

  const wallet = walletName(externalWallet.app);
  const stepLabel = (step: WalletStep) =>
    ({
      switch: `Switch network in ${wallet}…`,
      message: 'Preparing sign-in…',
      sign: `Sign in ${wallet}…`,
      verify: 'Checking your signature…',
    })[step];

  /** Picks and connects a wallet, then asks it to sign in straight away. */
  const chooseWallet = async () => {
    setError(undefined);
    setNotice(undefined);
    const picked = await openWalletPicker();
    if (picked.status === 'cancelled') {
      const name = walletName(picked.app);
      setNotice({
        tone: 'error',
        title: 'Connection cancelled',
        message: `You cancelled before ${name} connected.`,
        actions: [{ label: 'Connect wallet', onPress: chooseWallet }],
      });
      return;
    }
    if (picked.status !== 'connected') return;
    setConnectedTopic(currentExternalWallet().topic);
    await walletSignIn(picked.address);
  };

  /**
   * A failed wallet sign-in, told plainly. A timed-out or lost connection was
   * already dropped (externalWallet), so those offer a fresh connect.
   */
  function signInNotice(e: unknown, address: string): NoticeContent {
    const signAgain = {
      label: 'Try again',
      onPress: () => void walletSignIn(address),
    };
    const reconnect = { label: 'Connect again', onPress: chooseWallet };
    if (!(e instanceof WalletError)) {
      // Privy or the backend.
      return {
        tone: 'error',
        title: 'Couldn’t sign you in',
        message: walletErrorMessage(e),
        actions: [signAgain],
      };
    }
    switch (e.kind) {
      case 'cancelled':
        return {
          tone: 'error',
          title: 'Sign-in cancelled',
          message: `You stopped waiting for ${wallet}.`,
          actions: [signAgain],
        };
      case 'rejected':
        return {
          tone: 'error',
          title: 'Sign-in declined',
          message: `You declined to sign in ${wallet}. Signing is free and doesn’t move any funds.`,
          actions: [signAgain],
        };
      case 'timeout':
        return {
          tone: 'error',
          title: `No response from ${wallet}`,
          message: 'The sign-in request timed out.',
          actions: [reconnect],
        };
      case 'expired':
        return {
          tone: 'error',
          title: 'Connection lost',
          message: `${capitalized(wallet)} is no longer connected to Zeno.`,
          actions: [reconnect],
        };
      case 'offline':
        return {
          tone: 'error',
          title: 'You’re offline',
          message: 'Check your connection and try again.',
          actions: [signAgain],
        };
      default:
        return {
          tone: 'error',
          title: 'Couldn’t sign you in',
          message: e.message,
          actions: [signAgain],
        };
    }
  }

  // Back in Zeno twice without signing: the wallet was likely closed.
  const stalledNotice: NoticeContent | undefined =
    (walletStep === 'switch' || walletStep === 'sign') && externalWallet.stalled
      ? {
          tone: 'warning',
          title: `${capitalized(wallet)} closed before you answered`,
          message: `The sign-in request is still waiting in ${wallet}.`,
          actions: [
            ...(externalWallet.app?.scheme
              ? [
                  {
                    label: `Open ${wallet}`,
                    onPress: () => void openWalletApp(),
                  },
                ]
              : []),
            { label: 'Cancel', onPress: cancelWalletRequest },
          ],
        }
      : undefined;

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ImageBackground
        source={require('../../assets/images/login-background.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <ScrollView
        style={styles.fill}
        contentContainerStyle={[
          styles.scroll,
          {
            // The sheet sits on the bottom edge; above the keyboard when open.
            paddingBottom: keyboardHeight,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        bounces={false}
      >
        <View
          style={[
            styles.card,
            { paddingBottom: (keyboardHeight > 0 ? 0 : insets.bottom) + 28 },
          ]}
        >
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
              resendAfterSeconds={RESEND_AFTER_SECONDS}
              onVerify={verifyEmailCode}
              onResend={resendEmailCode}
              onGoogle={googleSignIn}
              onWallet={chooseWallet}
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
              {isConnected &&
              address &&
              connectedTopic &&
              externalWallet.topic === connectedTopic ? (
                <>
                  <LightButton
                    label={
                      walletStep
                        ? stepLabel(walletStep)
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
                    walletStep
                      ? stepLabel(walletStep)
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
          {(stalledNotice ?? notice) ? (
            <View style={styles.notice}>
              <Notice {...(stalledNotice ?? notice)!} />
            </View>
          ) : null}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  fill: { flex: 1 },
  scroll: { flexGrow: 1, justifyContent: 'flex-end' },
  // A sheet on the bottom edge, top corners rounded (design).
  card: {
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    paddingHorizontal: 27,
    paddingTop: 32,
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
  notice: { marginTop: 14 },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginTop: 14,
  },
});
