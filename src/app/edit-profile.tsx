/**
 * Edit profile (Profile → user icon): name and country. Saves through the
 * same POST /auth/profile as the first-time Complete your profile step.
 * Opens as a sheet; Cancel closes it without saving.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Field } from '../components/ui';
import { useKeyboardHeight } from '../hooks/useKeyboardHeight';
import { useSession } from '../hooks/useSession';
import { useUser } from '../hooks/useUser';
import * as api from '../lib/api';
import { colors, fonts, space, type } from '../theme/tokens';

export default function EditProfileScreen() {
  const insets = useSafeAreaInsets();
  const keyboardHeight = useKeyboardHeight();
  const user = useUser();
  const { setUser } = useSession();
  const [firstName, setFirstName] = useState(user.firstName ?? '');
  const [lastName, setLastName] = useState(user.lastName ?? '');
  const [country, setCountry] = useState(user.country ?? '');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string>();

  const details = {
    firstName: firstName.trim(),
    lastName: lastName.trim(),
    country: country.trim().toUpperCase(),
  };
  const complete =
    details.firstName && details.lastName && /^[A-Z]{2}$/.test(details.country);
  const changed =
    details.firstName !== (user.firstName ?? '') ||
    details.lastName !== (user.lastName ?? '') ||
    details.country !== (user.country ?? '');
  const canSave = Boolean(complete && changed && !busy);

  const close = () =>
    router.canGoBack() ? router.back() : router.replace('/profile');

  const save = async () => {
    setBusy(true);
    setError(undefined);
    try {
      setUser(await api.completeProfile(user, details));
      close();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save your profile.');
    } finally {
      setBusy(false);
    }
  };

  // iOS shows this as a page sheet below the status bar; Android full screen.
  const top = Platform.OS === 'ios' ? 0 : insets.top;

  return (
    <View style={[styles.root, { paddingTop: top }]}>
      <View style={styles.bar}>
        <Pressable
          onPress={close}
          disabled={busy}
          accessibilityRole="button"
          hitSlop={12}
          style={({ pressed }) => [styles.barLeft, pressed && styles.pressed]}
        >
          <Text style={styles.cancel}>Cancel</Text>
        </Pressable>
        <Text style={styles.barTitle} accessibilityRole="header">
          Edit profile
        </Text>
        <Pressable
          onPress={save}
          disabled={!canSave}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSave, busy }}
          hitSlop={12}
          style={({ pressed }) => [styles.barRight, pressed && styles.pressed]}
        >
          <Text style={[styles.save, !canSave && styles.saveDisabled]}>
            {busy ? 'Saving…' : 'Save'}
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingBottom:
              (keyboardHeight > 0 ? keyboardHeight : insets.bottom) + space.xxl,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Field
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoComplete="given-name"
          textContentType="givenName"
        />
        <Field
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoComplete="family-name"
          textContentType="familyName"
        />
        <Field
          label="Country (2-letter code)"
          value={country}
          onChangeText={text => setCountry(text.slice(0, 2))}
          placeholder="GB"
          autoCapitalize="characters"
          maxLength={2}
        />
        {error ? <Text style={styles.error}>{error}</Text> : null}
        {user.email ? (
          <Text style={styles.note}>
            Your email ({user.email}) is how you sign in, so it can&apos;t be
            changed here.
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bar: {
    height: 56,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.lineStrong,
  },
  barTitle: { fontFamily: fonts.semibold, fontSize: 16, color: colors.text },
  barLeft: { position: 'absolute', left: space.lg, paddingVertical: space.sm },
  barRight: {
    position: 'absolute',
    right: space.lg,
    paddingVertical: space.sm,
  },
  cancel: { fontFamily: fonts.regular, fontSize: 16, color: colors.muted },
  save: { fontFamily: fonts.semibold, fontSize: 16, color: colors.gold },
  saveDisabled: { color: colors.dim },
  pressed: { opacity: 0.6 },
  content: { padding: space.xl, gap: space.lg },
  error: { ...type.small, color: colors.danger },
  note: { ...type.small, color: colors.dim },
});
