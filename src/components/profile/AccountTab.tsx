import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSession } from '../../hooks/useSession';
import { formatDate } from '../../lib/format';
import type { User } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { SignOutIcon } from '../icons';
import { Badge } from '../ui';
import { InfoRow } from './InfoRow';

/** Profile → Account: personal details and sign out. */
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
  signOutText: { fontFamily: fonts.regular, fontSize: 16, color: colors.red },
});
