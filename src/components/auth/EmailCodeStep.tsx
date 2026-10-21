/**
 * Sign-in step 2 for email (design): the email with a CHANGE link, the 6-digit
 * code in six boxes, Verify code, the resend countdown, and "Connect with"
 * Google or a wallet instead. Wrong / expired / locked codes show under the
 * boxes (not in the design; the boxes turn red).
 *
 * One hidden TextInput sits over the boxes and takes the typing, pasting and
 * SMS / email autofill (autoComplete="one-time-code"); the boxes only draw it.
 *
 * The parent decides what Verify, Resend, Google and wallet do (sign-in.tsx).
 */
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../../theme/tokens';
import { GoogleIcon, WalletIcon } from '../icons';
import { DIVIDER, INPUT_BG, INPUT_BORDER } from './palette';
import { PrimaryButton } from './PrimaryButton';

const CODE_LENGTH = 6;

export type CodeError =
  /** The code timed out; the user needs a new one. */
  | { kind: 'expired'; triesLeft?: number }
  /** The code didn't match. */
  | { kind: 'invalid'; triesLeft?: number }
  /** No tries left: only a new code helps. */
  | { kind: 'locked' };

function codeErrorMessage(error: CodeError): string {
  const tries =
    'triesLeft' in error && error.triesLeft !== undefined
      ? ` · ${error.triesLeft} ${error.triesLeft === 1 ? 'try' : 'tries'} left`
      : '';
  switch (error.kind) {
    case 'expired':
      return `This code expired. Send a new one.${tries}`;
    case 'invalid':
      return `That code isn't right. Check it and try again.${tries}`;
    case 'locked':
      return 'Too many tries. Send a new code to continue.';
  }
}

/** 42 → "0:42". */
const clock = (seconds: number) =>
  `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

export function EmailCodeStep({
  email,
  error,
  busy,
  resendAfterSeconds = 0,
  onVerify,
  onResend,
  onChangeEmail,
  onGoogle,
  onWallet,
}: {
  email: string;
  error?: CodeError;
  busy?: 'verify' | 'resend';
  /**
   * Resend cooldown; counts down here. Give the step a new `key` for each
   * code sent so the countdown restarts.
   */
  resendAfterSeconds?: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
  /** "Connect with": sign in with Google or a wallet instead. */
  onGoogle: () => void;
  onWallet: () => void;
}) {
  const input = useRef<TextInput>(null);
  const [code, setCode] = useState('');
  const [focused, setFocused] = useState(true);
  const [cooldown, setCooldown] = useState(resendAfterSeconds);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // An expired or used-up code can't be verified; only a new one helps.
  const needsNewCode = error?.kind === 'expired' || error?.kind === 'locked';
  const canVerify = code.length === CODE_LENGTH && !busy && !needsNewCode;
  const canResend = !busy && cooldown <= 0;

  const resend = () => {
    setCode('');
    onResend();
  };

  return (
    <>
      <Text style={styles.title}>Sign in</Text>
      <Text style={styles.subtitle}>
        We have sent a One-Time Passcode to your email
      </Text>

      <View style={styles.emailHead}>
        <Text style={styles.label}>EMAIL ADDRESS</Text>
        <Pressable
          onPress={onChangeEmail}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Change email address"
          hitSlop={10}
        >
          <Text style={styles.change}>CHANGE</Text>
        </Pressable>
      </View>
      <Text style={styles.email} numberOfLines={1}>
        {email}
      </Text>

      <Pressable
        onPress={() => input.current?.focus()}
        accessibilityLabel="6-digit code"
        style={styles.boxes}
      >
        {Array.from({ length: CODE_LENGTH }, (_, i) => {
          const active =
            focused &&
            (i === code.length ||
              (i === CODE_LENGTH - 1 && code.length === CODE_LENGTH));
          return (
            <View
              key={i}
              style={[
                styles.box,
                active && styles.boxActive,
                error && styles.boxError,
              ]}
            >
              <Text style={styles.digit}>{code[i] ?? ''}</Text>
            </View>
          );
        })}
        <TextInput
          ref={input}
          value={code}
          onChangeText={text =>
            setCode(text.replace(/\D/g, '').slice(0, CODE_LENGTH))
          }
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          autoFocus
          keyboardType="number-pad"
          autoComplete="one-time-code"
          textContentType="oneTimeCode"
          maxLength={CODE_LENGTH}
          caretHidden
          onSubmitEditing={() => canVerify && onVerify(code)}
          style={styles.hiddenInput}
          accessibilityLabel="6-digit code"
        />
      </Pressable>
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {codeErrorMessage(error)}
        </Text>
      ) : null}

      <View style={styles.verify}>
        <PrimaryButton
          label="Verify code"
          onPress={() => onVerify(code)}
          disabled={!canVerify}
          busy={busy === 'verify'}
        />
      </View>
      {cooldown > 0 ? (
        <Text style={styles.resendWait}>Resend in {clock(cooldown)}</Text>
      ) : (
        <Pressable
          onPress={resend}
          disabled={!canResend}
          accessibilityRole="button"
          style={styles.resendButton}
        >
          <Text style={[styles.resend, !canResend && styles.resendDisabled]}>
            Resend code
          </Text>
        </Pressable>
      )}

      <View style={styles.connect}>
        <Text style={styles.connectLabel}>CONNECT WITH</Text>
        <View style={styles.connectLine} />
        <Pressable
          onPress={onGoogle}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Continue with Google"
          style={({ pressed }) => [styles.method, pressed && styles.pressed]}
        >
          <GoogleIcon size={20} />
        </Pressable>
        <Pressable
          onPress={onWallet}
          disabled={!!busy}
          accessibilityRole="button"
          accessibilityLabel="Connect wallet"
          style={({ pressed }) => [styles.method, pressed && styles.pressed]}
        >
          <WalletIcon color={colors.green} size={20} />
        </Pressable>
      </View>
    </>
  );
}

// Same type and input values as the email step in sign-in.tsx.
const styles = StyleSheet.create({
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
  emailHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 28,
  },
  label: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.muted,
  },
  change: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.4,
    color: colors.gold,
  },
  email: {
    fontFamily: fonts.regular,
    fontSize: 16,
    lineHeight: 22,
    color: colors.text,
    marginTop: 6,
  },
  boxes: { flexDirection: 'row', gap: 10, marginTop: 22 },
  box: {
    flex: 1,
    height: 48,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    backgroundColor: INPUT_BG,
    alignItems: 'center',
    justifyContent: 'center',
  },
  boxActive: { borderColor: colors.green },
  boxError: { borderColor: colors.danger },
  digit: { fontFamily: fonts.medium, fontSize: 20, color: colors.text },
  // Over the boxes, invisible: it takes focus, typing, paste and autofill.
  hiddenInput: {
    ...StyleSheet.absoluteFill,
    opacity: 0.02,
    color: 'transparent',
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginTop: 8,
  },
  verify: { marginTop: 4 },
  resendWait: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.muted,
    textAlign: 'center',
    paddingVertical: 12,
  },
  resendButton: { alignSelf: 'center', paddingVertical: 12 },
  resend: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
  resendDisabled: { color: colors.dim },
  connect: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginTop: 36,
  },
  connectLabel: {
    fontFamily: fonts.medium,
    fontSize: 11,
    letterSpacing: 0.6,
    color: colors.muted,
  },
  connectLine: { flex: 1, height: 1, backgroundColor: DIVIDER },
  method: {
    width: 48,
    height: 48,
    borderRadius: 10,
    backgroundColor: colors.surface3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pressed: { opacity: 0.8 },
});
