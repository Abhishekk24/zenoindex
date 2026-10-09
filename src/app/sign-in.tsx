/**
 * Sign in with an email code or a wallet signature (design: sign-in mockup).
 *
 * Wallet sign-in: connect a wallet (AppKit), then sign the server's login
 * challenge — a signature only, no transaction. A new wallet gets a new
 * account, which then goes through terms and profile like an email sign-up.
 */
import { useAppKit, useAppKitState } from '@reown/appkit-react-native';
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
import { useAccount, useAccountEffect, useSignMessage } from 'wagmi';

import { LightButton } from '../components/auth/LightButton';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import { GoogleIcon } from '../components/icons';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
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
  const { open } = useAppKit();
  const { isOpen: pickerOpen } = useAppKitState();
  const { address, isConnected } = useAccount();
  const { signMessageAsync } = useSignMessage();
  // Set when the user taps Connect wallet: once a wallet connects, ask it to
  // sign straight away rather than waiting for a second tap.
  const signInOnConnect = useRef(false);

  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState<'email' | 'code' | 'wallet' | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // Server-enforced resend cooldown (from the OTP response envelope).
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(
    kind: 'email' | 'code' | 'wallet',
    task: () => Promise<void>,
    errorMessage: (e: unknown) => string = e =>
      e instanceof Error ? e.message : 'Something went wrong.',
  ) {
    setBusy(kind);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(errorMessage(e));
    } finally {
      setBusy(null);
    }
  }

  const applyOtpResult = (result: api.OtpResult) => {
    setCooldown(result.resendAfterSeconds ?? 0);
    setNotice(
      result.status === 'not_configured'
        ? 'Email delivery is not configured on the server; the code is printed in the server console in development.'
        : result.status === 'rate_limited'
          ? `A code was already sent. You can resend in ${result.resendAfterSeconds ?? 0}s.`
          : undefined,
    );
  };

  const validEmail = EMAIL.test(email.trim());

  const sendCode = () =>
    run('email', async () => {
      applyOtpResult(await api.requestEmailCode(email.trim()));
      setStep('code');
    });

  const resend = () =>
    run('email', async () => {
      setCode('');
      applyOtpResult(await api.resendEmailCode(email.trim()));
    });

  const verify = () =>
    run('code', async () => {
      setUser(await api.verifyEmailCode(email.trim(), code));
    });

  const walletSignIn = (wallet: string) =>
    run(
      'wallet',
      async () => {
        const challenge = await api.requestWalletLoginChallenge(wallet);
        const signature = await signMessageAsync({
          account: wallet as `0x${string}`,
          message: challenge.message,
        });
        setUser(
          await api.walletLogin({
            walletAddress: wallet,
            message: challenge.message,
            signature,
          }),
        );
      },
      walletErrorMessage,
    );

  const chooseWallet = () => {
    setError(undefined);
    setNotice(undefined);
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

  const backToEmail = () => {
    setStep('email');
    setCode('');
    setNotice(undefined);
    setError(undefined);
  };

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
          {step === 'email' ? (
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
                onSubmitEditing={() => validEmail && sendCode()}
                style={styles.input}
              />
              <PrimaryButton
                label="Send code"
                onPress={sendCode}
                disabled={!validEmail || busy !== null}
                busy={busy === 'email'}
              />

              <View style={styles.dividerRow}>
                <View style={styles.dividerLine} />
                <Text style={styles.dividerText}>OR CONTINUE WITH</Text>
                <View style={styles.dividerLine} />
              </View>

              <LightButton
                label="Continue with Google"
                icon={<GoogleIcon />}
                onPress={() => {
                  setError(undefined);
                  setNotice('Google sign-in is coming soon.');
                }}
                disabled={busy !== null}
              />
              {isConnected && address ? (
                <>
                  <LightButton
                    label={
                      busy === 'wallet'
                        ? 'Check your wallet to sign…'
                        : `Sign in with ${shortAddress(address)}`
                    }
                    onPress={() => walletSignIn(address)}
                    disabled={busy !== null}
                  />
                  <Pressable
                    onPress={chooseWallet}
                    disabled={busy !== null}
                    accessibilityRole="button"
                    style={styles.linkButton}
                  >
                    <Text style={styles.link}>Use a different wallet</Text>
                  </Pressable>
                </>
              ) : (
                <LightButton
                  label={
                    busy === 'wallet'
                      ? 'Check your wallet to sign…'
                      : pickerOpen
                        ? 'Choose a wallet…'
                        : 'Connect wallet'
                  }
                  onPress={chooseWallet}
                  disabled={busy !== null}
                />
              )}
            </>
          ) : (
            <>
              <Text style={styles.title}>Check your email</Text>
              <Text style={styles.subtitle}>
                We sent a 6-digit code to{' '}
                <Text style={styles.strong}>{email.trim()}</Text>.
              </Text>

              <Text style={styles.label}>CODE</Text>
              <TextInput
                value={code}
                onChangeText={text =>
                  setCode(text.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                placeholderTextColor={colors.dim}
                selectionColor={colors.green}
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                onSubmitEditing={() => code.length === 6 && verify()}
                style={[styles.input, styles.codeInput]}
              />
              <PrimaryButton
                label="Verify"
                onPress={verify}
                disabled={code.length !== 6 || busy !== null}
                busy={busy === 'code'}
              />
              <View style={styles.codeLinks}>
                <Pressable
                  onPress={backToEmail}
                  accessibilityRole="button"
                  style={styles.linkButton}
                >
                  <Text style={styles.link}>Change email</Text>
                </Pressable>
                <Pressable
                  onPress={resend}
                  disabled={busy !== null || cooldown > 0}
                  accessibilityRole="button"
                  style={styles.linkButton}
                >
                  <Text
                    style={[
                      styles.link,
                      (busy !== null || cooldown > 0) && styles.linkDisabled,
                    ]}
                  >
                    {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
                  </Text>
                </Pressable>
              </View>
            </>
          )}

          {notice ? <Text style={styles.notice}>{notice}</Text> : null}
          {error ? <Text style={styles.error}>{error}</Text> : null}

          <Text style={styles.footer}>
            By continuing you agree to the Terms{'\n'}and Privacy Policy.
          </Text>

          {/* Development builds only: go straight in as the sample investor
              (no session, so account-only API calls will fail). */}
          {__DEV__ && (
            <Pressable
              onPress={() => setUser(api.sampleInvestor())}
              accessibilityRole="button"
              style={styles.linkButton}
            >
              <Text style={styles.devSkip}>Skip sign-in (dev)</Text>
            </Pressable>
          )}
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
  strong: { fontFamily: fonts.medium, color: colors.text },
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
  codeInput: { fontSize: 22, letterSpacing: 8, textAlign: 'center' },
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
  codeLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  linkButton: { paddingVertical: 10, alignSelf: 'center' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
  linkDisabled: { color: colors.dim },
  notice: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.gold,
    marginTop: 14,
  },
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
  devSkip: {
    fontFamily: fonts.medium,
    fontSize: 13,
    color: colors.dim,
    textDecorationLine: 'underline',
  },
});
