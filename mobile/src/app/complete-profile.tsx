/**
 * First sign-in, one step (design: Complete profile): name, country, and
 * agreeing to the Terms and Privacy Policy — both open in the in-app reader
 * (legal/[doc]) to read first. Save records the agreement (POST
 * /auth/accept-terms, if not given yet) and the profile (POST /auth/profile).
 * Shown at both the `terms` and `profile` stages (RootStack).
 */
import { router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useState } from 'react';
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

import { Checkbox } from '../components/auth/Checkbox';
import { CountryField } from '../components/auth/CountryField';
import { CARD_BG, INPUT_BG, INPUT_BORDER } from '../components/auth/palette';
import { PrimaryButton } from '../components/auth/PrimaryButton';
import type { LegalDocId } from '../content/legal';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import { useUser } from '../hooks/useUser';
import * as api from '../lib/api';
import { colors, fonts } from '../theme/tokens';

function openDocument(doc: LegalDocId) {
  router.push({ pathname: '/legal/[doc]', params: { doc } });
}

export default function CompleteProfileScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const user = useUser();
  const { setUser, signOut } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [country, setCountry] = useState((user.country ?? '').toUpperCase());
  const agreedBefore = Boolean(user.termsAcceptedAt && user.privacyAcceptedAt);
  const [agreed, setAgreed] = useState(agreedBefore);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const complete =
    firstName.trim() !== '' &&
    lastName.trim() !== '' &&
    /^[A-Z]{2}$/.test(country) &&
    agreed;

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      const accepted = agreedBefore ? user : await api.acceptTerms(user);
      setUser(
        await api.completeProfile(accepted, {
          firstName: firstName.trim(),
          lastName: lastName.trim(),
          country,
        }),
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <StatusBar style="dark" />
      <ImageBackground
        source={require('../../assets/images/login-background.png')}
        resizeMode="cover"
        style={StyleSheet.absoluteFill}
      />
      <View style={[styles.sheet, { marginTop: insets.top + 12 }]}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          bounces={false}
        >
          <Text style={styles.title}>Complete profile</Text>
          <Text style={styles.subtitle}>
            Tell us your name and country to finish setting up your account.
          </Text>

          <Text style={styles.label}>FIRST NAME</Text>
          <TextInput
            value={firstName}
            onChangeText={setFirstName}
            placeholder="First name"
            placeholderTextColor={colors.dim}
            selectionColor={colors.green}
            autoComplete="given-name"
            textContentType="givenName"
            returnKeyType="next"
            style={styles.input}
          />

          <Text style={styles.label}>LAST NAME</Text>
          <TextInput
            value={lastName}
            onChangeText={setLastName}
            placeholder="Last name"
            placeholderTextColor={colors.dim}
            selectionColor={colors.green}
            autoComplete="family-name"
            textContentType="familyName"
            style={styles.input}
          />

          <Text style={styles.label}>COUNTRY</Text>
          <CountryField value={country} onChange={setCountry} />

          {/* Not in the design; kept from the old Terms step (agreed). */}
          <Text style={styles.risk}>
            Zeno doesn’t give investment advice. Investments can lose value.
          </Text>
          <Checkbox checked={agreed} onToggle={() => setAgreed(v => !v)}>
            I agree to the{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => openDocument('terms')}
            >
              Terms and Conditions
            </Text>{' '}
            and{' '}
            <Text
              style={styles.link}
              accessibilityRole="link"
              onPress={() => openDocument('privacy')}
            >
              Privacy Policy
            </Text>
            .
          </Checkbox>

          {error ? (
            <Text style={styles.error} accessibilityLiveRegion="polite">
              {error}
            </Text>
          ) : null}
        </ScrollView>

        <View
          style={[
            styles.footer,
            {
              paddingBottom:
                (keyboardHeight > 0 ? keyboardHeight : insets.bottom) + 16,
            },
          ]}
        >
          <PrimaryButton
            label="Save and continue"
            onPress={save}
            disabled={!complete || busy}
            busy={busy}
          />
          {/* Signed in with the wrong account: back to sign-in. */}
          <Pressable
            onPress={() => {
              setSigningOut(true);
              signOut()
                .catch(e =>
                  setError(e instanceof Error ? e.message : 'Sign-out failed.'),
                )
                .finally(() => setSigningOut(false));
            }}
            disabled={busy || signingOut}
            accessibilityRole="button"
            style={styles.linkButton}
          >
            <Text style={styles.switchLink}>
              {signingOut ? 'Signing out…' : 'Use a different account'}
            </Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

// Type and input values follow the sign-in screen (sign-in.tsx).
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  sheet: {
    flex: 1,
    backgroundColor: CARD_BG,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    overflow: 'hidden',
  },
  content: { paddingHorizontal: 27, paddingTop: 32, paddingBottom: 24 },
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
  risk: {
    fontFamily: fonts.regular,
    fontSize: 12,
    lineHeight: 18,
    color: colors.dim,
    marginTop: 28,
    marginBottom: 10,
  },
  // Readable as links: white and underlined.
  link: {
    fontFamily: fonts.medium,
    color: colors.text,
    textDecorationLine: 'underline',
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.danger,
    marginTop: 14,
  },
  footer: { paddingHorizontal: 27, paddingTop: 12 },
  // Same as sign-in's "Use a different wallet" link.
  linkButton: { paddingVertical: 10, alignSelf: 'center' },
  switchLink: { fontFamily: fonts.medium, fontSize: 13, color: colors.green },
});
