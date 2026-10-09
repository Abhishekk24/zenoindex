import React from 'react';
import { StyleSheet, Text, View } from 'react-native';

import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { formatDate } from '../../lib/format';
import type { User } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import { Badge, LoadState } from '../ui';
import { Section } from './Section';
import { SectionRow } from './SectionRow';

/** Profile → Security: 2FA, sign-in methods and active sessions. */
export function SecurityTab({
  user,
  refreshKey,
}: {
  user: User;
  /** Bumped by pull-to-refresh. */
  refreshKey: number;
}) {
  const { data, error, reload } = useLoad(
    api.listSessions,
    `sessions#${refreshKey}`,
  );
  return (
    <>
      <Section title="Two-factor authentication">
        <SectionRow
          label="Status"
          value={
            <Badge
              label={user.twoFactorEnabled ? 'On' : 'Off'}
              tone={user.twoFactorEnabled ? 'green' : 'neutral'}
            />
          }
        />
        <Text style={styles.body}>
          Ask for a code from an authenticator app each time you sign in.
        </Text>
        <View style={styles.action} accessibilityState={{ disabled: true }}>
          <Text style={styles.actionText}>
            {user.twoFactorEnabled ? 'Turn off' : 'Set up'} · Coming soon
          </Text>
        </View>
      </Section>

      <Section title="Sign-in method">
        <SectionRow
          label="Email code"
          value={<Badge label="On" tone="green" />}
        />
        <SectionRow
          label="Google"
          value={<Badge label="Coming soon" tone="neutral" />}
        />
      </Section>

      <Section title="Active sessions">
        {!data ? (
          <LoadState error={error} onRetry={reload} />
        ) : (
          data.map(session => (
            <SectionRow
              key={session.id}
              label={session.device}
              sublabel={`LAST ACTIVE ${formatDate(session.lastActive).toUpperCase()}`}
              strong
              value={
                session.current ? <Badge label="Current" tone="gold" /> : null
              }
            />
          ))
        )}
      </Section>
    </>
  );
}

const styles = StyleSheet.create({
  body: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
    marginHorizontal: space.lg,
    paddingTop: 14,
    paddingBottom: space.lg,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  action: {
    backgroundColor: colors.primaryGreen,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
  },
  actionText: { fontFamily: fonts.regular, fontSize: 14, color: '#ffffff' },
});
