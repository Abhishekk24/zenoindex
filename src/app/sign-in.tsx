/** Sign in with an email code. The wallet is linked later and never signs in. */
import React, { useEffect, useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import {
  Body,
  Button,
  Card,
  Display,
  Field,
  Label,
  Screen,
} from '../components/ui';
import * as api from '../lib/api';
import { useSession } from '../lib/session';
import { colors, space, type } from '../theme/tokens';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export default function SignInScreen() {
  const { setUser } = useSession();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();
  // Server-enforced resend cooldown (from the OTP response envelope).
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = setTimeout(() => setCooldown(s => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [cooldown]);

  async function run(task: () => Promise<void>) {
    setBusy(true);
    setError(undefined);
    try {
      await task();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
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

  const sendCode = () =>
    run(async () => {
      const result = await api.requestEmailCode(email.trim());
      applyOtpResult(result);
      setStep('code');
    });

  const resend = () =>
    run(async () => {
      setCode('');
      applyOtpResult(await api.resendEmailCode(email.trim()));
    });

  const verify = () =>
    run(async () => {
      setUser(await api.verifyEmailCode(email.trim(), code));
    });

  return (
    <KeyboardAvoidingView
      style={styles.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      <Screen topInset>
        <View style={styles.brand}>
          <Label accent>Zeno by CyreneAI</Label>
          <Display>Invest in on-chain baskets</Display>
          <Body muted>
            Sign in with your email. You can link a wallet afterwards to invest.
          </Body>
        </View>

        <Card banded>
          {step === 'email' ? (
            <>
              <Field
                label="Email address"
                value={email}
                onChangeText={setEmail}
                placeholder="you@example.com"
                autoCapitalize="none"
                autoComplete="email"
                keyboardType="email-address"
                textContentType="emailAddress"
                returnKeyType="send"
                onSubmitEditing={() => EMAIL.test(email.trim()) && sendCode()}
              />
              <Button
                label="Email me a code"
                onPress={sendCode}
                disabled={!EMAIL.test(email.trim())}
                loading={busy}
              />
            </>
          ) : (
            <>
              <Body>
                We sent a 6-digit code to{' '}
                <Text style={{ color: colors.text }}>{email.trim()}</Text>.
              </Body>
              {notice ? (
                <Text style={[type.small, { color: colors.gold }]}>
                  {notice}
                </Text>
              ) : null}
              <Field
                label="Enter the 6-digit code"
                value={code}
                onChangeText={text =>
                  setCode(text.replace(/\D/g, '').slice(0, 6))
                }
                placeholder="000000"
                keyboardType="number-pad"
                autoComplete="one-time-code"
                textContentType="oneTimeCode"
                maxLength={6}
                style={styles.code}
                onSubmitEditing={verify}
              />
              <Button
                label="Verify"
                onPress={verify}
                disabled={code.length !== 6}
                loading={busy}
              />
              <View style={styles.links}>
                <Button
                  label="Change email"
                  variant="ghost"
                  onPress={() => {
                    setStep('email');
                    setCode('');
                    setNotice(undefined);
                  }}
                />
                <Button
                  label={
                    cooldown > 0 ? `Resend in ${cooldown}s` : 'Resend code'
                  }
                  variant="ghost"
                  onPress={resend}
                  disabled={busy || cooldown > 0}
                />
              </View>
            </>
          )}
          {error ? (
            <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
          ) : null}
        </Card>

        {__DEV__ && (
          <Card>
            <Label>Development</Label>
            <Body muted>
              Skip sign-in with the sample account (terms, profile and a linked
              wallet already done). API-backed data still requires the hosted
              app to be reachable.
            </Body>
            <Button
              label="Continue as sample investor"
              variant="outline"
              onPress={() => setUser(api.sampleInvestor())}
            />
          </Card>
        )}
      </Screen>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  brand: { gap: space.sm, paddingTop: space.xl, paddingBottom: space.sm },
  code: { letterSpacing: 8, fontSize: 22, textAlign: 'center' },
  links: { flexDirection: 'row', justifyContent: 'space-between' },
});
