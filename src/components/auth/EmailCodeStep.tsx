/**
 * Sign-in step 2 for email: enter the 6-digit code that was emailed
 * (zeno-mobile-ui design), with the code-expired / wrong-code error line from
 * the investor field reference.
 *
 * The parent decides what Verify and Resend do (sign-in.tsx: Privy's email
 * code).
 */
import React, { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { colors, fonts } from '../../theme/tokens';
import { INPUT_BG, INPUT_BORDER } from './palette';
import { PrimaryButton } from './PrimaryButton';

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

export function EmailCodeStep({
  email,
  error,
  busy,
  resendAfterSeconds = 0,
  onVerify,
  onResend,
  onChangeEmail,
}: {
  email: string;
  error?: CodeError;
  busy?: 'verify' | 'resend';
  /**
   * Resend cooldown from the server; counts down here. Give the step a new
   * `key` for each code sent so the countdown restarts.
   */
  resendAfterSeconds?: number;
  onVerify: (code: string) => void;
  onResend: () => void;
  onChangeEmail: () => void;
}) {
  const [code, setCode] = useState('');
  const [cooldown, setCooldown] = useState(resendAfterSeconds);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  // An expired or used-up code can't be verified; only a new one helps.
  const needsNewCode = error?.kind === 'expired' || error?.kind === 'locked';
  const canVerify = code.length === 6 && !busy && !needsNewCode;
  const canResend = !busy && cooldown <= 0;

  const resend = () => {
    setCode('');
    onResend();
  };

  return (
    <>
      <Text style={styles.title}>Check your email</Text>
      <Text style={styles.subtitle}>
        We sent a 6-digit code to <Text style={styles.strong}>{email}</Text>.
      </Text>

      <Text style={styles.label}>CODE</Text>
      <TextInput
        value={code}
        onChangeText={text => setCode(text.replace(/\D/g, '').slice(0, 6))}
        placeholder="000000"
        placeholderTextColor={colors.dim}
        selectionColor={colors.green}
        keyboardType="number-pad"
        autoComplete="one-time-code"
        textContentType="oneTimeCode"
        maxLength={6}
        onSubmitEditing={() => canVerify && onVerify(code)}
        style={[styles.input, error && styles.inputError]}
        accessibilityLabel="6-digit code"
      />
      {error ? (
        <Text style={styles.error} accessibilityLiveRegion="polite">
          {codeErrorMessage(error)}
        </Text>
      ) : null}

      <PrimaryButton
        label="Verify"
        onPress={() => onVerify(code)}
        disabled={!canVerify}
        busy={busy === 'verify'}
      />
      <View style={styles.codeLinks}>
        <Pressable
          onPress={onChangeEmail}
          disabled={!!busy}
          accessibilityRole="button"
          style={styles.linkButton}
        >
          <Text style={styles.link}>Change email</Text>
        </Pressable>
        <Pressable
          onPress={resend}
          disabled={!canResend}
          accessibilityRole="button"
          style={styles.linkButton}
        >
          <Text style={[styles.link, !canResend && styles.linkDisabled]}>
            {cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'}
          </Text>
        </Pressable>
      </View>
    </>
  );
}

// Same values as the email step in sign-in.tsx (zeno-mobile-ui).
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
    fontSize: 22,
    letterSpacing: 8,
    textAlign: 'center',
    color: colors.text,
    backgroundColor: INPUT_BG,
    borderWidth: 1,
    borderColor: INPUT_BORDER,
    borderRadius: 10,
    paddingHorizontal: 16,
    height: 48,
  },
  inputError: { borderColor: colors.danger },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginTop: 8,
  },
  codeLinks: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  linkButton: { paddingVertical: 10, alignSelf: 'center' },
  link: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
  linkDisabled: { color: colors.dim },
});
