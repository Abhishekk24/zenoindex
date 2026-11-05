import * as Application from 'expo-application';
import { router } from 'expo-router';
import React, { useState } from 'react';
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  Switch,
  Text,
  TextInput,
  View,
} from 'react-native';

import { LEGAL, type LegalDocId } from '../../content/legal';
import { useSession } from '../../hooks/useSession';
import * as api from '../../lib/api';
import { switchMode, useAppMode } from '../../lib/appMode';
import { formatDate } from '../../lib/format';
import type { User } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { SignOutIcon } from '../icons';
import { Badge, Label } from '../ui';
import { InfoRow } from './InfoRow';

const DOCS: LegalDocId[] = ['terms', 'privacy'];

/**
 * Profile → Account: personal details, Manager Mode, legal documents and
 * sign out.
 */
export function AccountTab({ user }: { user: User }) {
  const { signOut, setUser } = useSession();
  const [signingOut, setSigningOut] = useState(false);
  const { mode, switchingTo } = useAppMode();
  const [error, setError] = useState<string>();
  // Email edit (wallet sign-ins; a verified one comes from the sign-in method and is read-only).
  const [emailDraft, setEmailDraft] = useState<string>();
  const [savingEmail, setSavingEmail] = useState(false);
  const [emailError, setEmailError] = useState<string>();

  const saveEmail = async () => {
    const email = emailDraft?.trim() ?? '';
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setEmailError('Enter a valid email address.');
      return;
    }
    setSavingEmail(true);
    setEmailError(undefined);
    try {
      setUser(await api.setEmail(email));
      setEmailDraft(undefined);
    } catch (e) {
      setEmailError(e instanceof Error ? e.message : 'Could not save email.');
    } finally {
      setSavingEmail(false);
    }
  };
  // Shows the target state while switching, so the switch moves at once.
  const managerOn = (switchingTo ?? mode) === 'manager';
  const name =
    [user.firstName, user.lastName].filter(Boolean).join(' ') ||
    user.displayName ||
    '—';
  const methods = [
    user.email ? 'Email' : null,
    user.wallets.length > 0 ? 'Wallet' : null,
  ].filter(Boolean);

  return (
    <View>
      <InfoRow label="Name" value={name} />
      <InfoRow label="Sign-in methods" value={methods.join(' · ') || '—'} />
      <InfoRow label="Country" value={user.country ?? '—'} />
      <InfoRow label="Member since" value={formatDate(user.createdAt)} />
      <InfoRow
        label="Email"
        value={user.email || '—'}
        // Verified means the sign-in method (email code / Google) confirmed it.
        extra={
          user.email && user.emailVerified ? (
            <Badge label="Verified" tone="green" />
          ) : null
        }
        right={
          !user.emailVerified && emailDraft === undefined ? (
            <Pressable
              onPress={() => setEmailDraft(user.email)}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>
                {user.email ? 'Change' : 'Add'}
              </Text>
            </Pressable>
          ) : null
        }
      />
      {emailDraft !== undefined ? (
        <View style={styles.emailEdit}>
          <TextInput
            value={emailDraft}
            onChangeText={setEmailDraft}
            placeholder="you@example.com"
            placeholderTextColor={colors.muted}
            keyboardType="email-address"
            autoCapitalize="none"
            autoCorrect={false}
            autoFocus
            editable={!savingEmail}
            onSubmitEditing={saveEmail}
            style={styles.emailInput}
            selectionColor={colors.green}
            accessibilityLabel="Email address"
          />
          <View style={styles.emailActions}>
            <Pressable
              onPress={() => {
                setEmailDraft(undefined);
                setEmailError(undefined);
              }}
              disabled={savingEmail}
              accessibilityRole="button"
              style={({ pressed }) => [styles.link, pressed && styles.pressed]}
            >
              <Text style={styles.linkText}>Cancel</Text>
            </Pressable>
            <Pressable
              onPress={saveEmail}
              disabled={savingEmail}
              accessibilityRole="button"
              accessibilityState={{ busy: savingEmail }}
              style={({ pressed }) => [
                styles.save,
                (pressed || savingEmail) && styles.pressed,
              ]}
            >
              <Text style={styles.saveText}>
                {savingEmail ? 'Saving…' : 'Save'}
              </Text>
            </Pressable>
          </View>
          {emailError ? <Text style={styles.error}>{emailError}</Text> : null}
        </View>
      ) : null}
      {/* The whole row toggles: inside the swipeable profile tabs the native
          switch only reacts to a drag, never to a tap. It just shows the state. */}
      <Pressable
        onPress={() => void switchMode(managerOn ? 'investor' : 'manager')}
        disabled={switchingTo !== null}
        accessibilityRole="switch"
        accessibilityLabel="Manager Mode"
        accessibilityState={{
          checked: managerOn,
          disabled: switchingTo !== null,
        }}
        style={styles.modeRow}
      >
        <Text style={styles.modeLabel}>Manager Mode</Text>
        <View
          pointerEvents="none"
          importantForAccessibility="no-hide-descendants"
        >
          <Switch
            value={managerOn}
            disabled={switchingTo !== null}
            trackColor={{ false: colors.surface3, true: colors.primaryGreen }}
            thumbColor="#ffffff"
            ios_backgroundColor={colors.surface3}
            accessibilityElementsHidden
          />
        </View>
      </Pressable>

      <View style={styles.legal}>
        <Label>Legal</Label>
        {DOCS.map(doc => (
          <Pressable
            key={doc}
            onPress={() =>
              router.push({ pathname: '/legal/[doc]', params: { doc } })
            }
            accessibilityRole="button"
            style={({ pressed }) => [styles.doc, pressed && styles.pressed]}
          >
            <Text style={styles.docText}>{LEGAL[doc].title}</Text>
            <Text style={styles.chevron}>›</Text>
          </Pressable>
        ))}
      </View>
      {error ? <Text style={styles.error}>{error}</Text> : null}
      <Pressable
        onPress={() => {
          setError(undefined);
          setSigningOut(true);
          signOut()
            .catch(e =>
              setError(e instanceof Error ? e.message : 'Sign-out failed.'),
            )
            .finally(() => setSigningOut(false));
        }}
        disabled={signingOut}
        accessibilityRole="button"
        accessibilityState={{ busy: signingOut }}
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        {signingOut ? (
          <ActivityIndicator color={colors.red} size="small" />
        ) : (
          <SignOutIcon color={colors.red} />
        )}
        <Text style={styles.signOutText}>
          {signingOut ? 'Signing out…' : 'Sign out'}
        </Text>
      </Pressable>
      {Application.nativeApplicationVersion ? (
        <Text style={styles.version}>
          ZenoIndex {Application.nativeApplicationVersion}
          {Application.nativeBuildVersion
            ? ` (${Application.nativeBuildVersion})`
            : ''}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  modeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: space.md,
    paddingVertical: 14,
    paddingHorizontal: space.xs,
  },
  modeLabel: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  link: { paddingVertical: 6, paddingHorizontal: space.sm },
  linkText: { fontFamily: fonts.medium, fontSize: 14, color: colors.green },
  emailEdit: {
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  emailInput: {
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 10,
    paddingHorizontal: space.md,
    height: 44,
  },
  emailActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    alignItems: 'center',
    gap: space.sm,
  },
  save: {
    borderRadius: 8,
    backgroundColor: colors.primaryGreen,
    paddingHorizontal: 18,
    paddingVertical: 9,
  },
  saveText: { fontFamily: fonts.medium, fontSize: 14, color: colors.text },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    marginTop: space.sm,
  },
  signOut: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    alignSelf: 'center',
    marginTop: space.xxl,
    paddingVertical: space.md,
    paddingHorizontal: space.xl,
  },
  pressed: { opacity: 0.75 },
  legal: { marginTop: space.xl, gap: space.xs },
  doc: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 14,
    paddingHorizontal: space.xs,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  docText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  chevron: { fontFamily: fonts.regular, fontSize: 18, color: colors.muted },
  version: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.dim,
    textAlign: 'center',
  },
  signOutText: { fontFamily: fonts.regular, fontSize: 16, color: colors.red },
});
