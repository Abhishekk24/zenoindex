import * as Application from 'expo-application';
import { router } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { LEGAL, type LegalDocId } from '../../content/legal';
import { useSession } from '../../hooks/useSession';
import { formatDate } from '../../lib/format';
import type { User } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { SignOutIcon } from '../icons';
import { Badge, Label } from '../ui';
import { InfoRow } from './InfoRow';

const DOCS: LegalDocId[] = ['terms', 'privacy'];

/** Profile → Account: personal details, legal documents and sign out. */
export function AccountTab({ user }: { user: User }) {
  const { signOut } = useSession();
  const [error, setError] = useState<string>();
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
        value={user.email ?? '—'}
        // Email accounts are created by verifying a code sent to the address.
        extra={user.email ? <Badge label="Verified" tone="green" /> : null}
        last
      />

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
          signOut().catch(e =>
            setError(e instanceof Error ? e.message : 'Sign-out failed.'),
          );
        }}
        accessibilityRole="button"
        style={({ pressed }) => [styles.signOut, pressed && styles.pressed]}
      >
        <SignOutIcon color={colors.red} />
        <Text style={styles.signOutText}>Sign out</Text>
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
