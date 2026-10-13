import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { openInAppBrowser } from '../../lib/browser';
import { formatDate, shortAddress } from '../../lib/format';
import { primaryWallet } from '../../lib/user';
import type { KycStatus, User } from '../../lib/types';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { NoticeIcon } from '../icons';
import { LoadState } from '../ui';
import { InfoRow } from './InfoRow';

const KYC_LABEL: Record<KycStatus, string> = {
  not_started: 'Not started',
  pending: 'Pending',
  verified: 'Verified',
  rejected: 'Rejected',
};

const KYC_ACTION: Record<KycStatus, string | null> = {
  not_started: 'Get started',
  pending: 'Continue',
  rejected: 'Try again',
  verified: null,
};

/** Profile → Eligibility: KYC status for the primary wallet, and starting it. */
export function EligibilityTab({
  user,
  refreshKey,
}: {
  user: User;
  /** Bumped by pull-to-refresh. */
  refreshKey: number;
}) {
  const wallet = primaryWallet(user);
  const { data, error, reload } = useLoad(
    () => api.getEligibility(wallet),
    `${wallet ?? 'none'}#${refreshKey}`,
  );
  const [busy, setBusy] = useState(false);
  const [kycError, setKycError] = useState<string>();

  const startVerification = async () => {
    if (!wallet) return;
    setBusy(true);
    setKycError(undefined);
    try {
      const session = await api.startKyc(wallet);
      if (session.url) {
        await openInAppBrowser(session.url);
      } else {
        setKycError('The provider returned no verification link.');
      }
      reload();
    } catch (e) {
      setKycError(
        e instanceof Error ? e.message : 'Verification could not start.',
      );
    } finally {
      setBusy(false);
    }
  };

  if (!data) return <LoadState error={error} onRetry={reload} />;
  const action = KYC_ACTION[data.kycStatus];
  const blocked = !wallet || busy;

  return (
    <View>
      <View style={styles.notice}>
        <NoticeIcon />
        <Text style={styles.noticeText}>
          <Text style={styles.noticeStrong}>Open baskets</Text> need only a
          linked wallet.{'\n'}
          <Text style={styles.noticeStrong}>Permissioned baskets</Text> also
          need identity verification for the wallet that will hold the shares.
        </Text>
      </View>

      <InfoRow
        label="Verification"
        value={KYC_LABEL[data.kycStatus].toUpperCase()}
        right={
          action ? (
            <Pressable
              onPress={startVerification}
              disabled={blocked}
              accessibilityRole="button"
              accessibilityState={{ disabled: blocked, busy }}
              style={({ pressed }) => [
                styles.pill,
                blocked && styles.disabled,
                pressed && styles.pressed,
              ]}
            >
              <Text style={styles.pillText}>{busy ? 'Opening…' : action}</Text>
            </Pressable>
          ) : null
        }
      />
      {!wallet ? (
        <Text style={styles.hint}>
          Link a wallet in the Wallets tab before starting verification.
        </Text>
      ) : null}
      {kycError ? <Text style={styles.error}>{kycError}</Text> : null}
      {wallet ? (
        <InfoRow label="Wallet being verified" value={shortAddress(wallet)} />
      ) : null}
      <InfoRow label="Provider" value={data.provider} />
      <InfoRow
        label="Verified"
        value={data.verifiedAt ? formatDate(data.verifiedAt) : '-'}
      />
      <InfoRow
        label="Permissioned basket"
        value={data.permissionedAccess ? 'ALLOWED' : 'NOT YET'}
        last
      />
    </View>
  );
}

const styles = StyleSheet.create({
  notice: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: space.md,
    paddingHorizontal: space.xs,
    paddingBottom: space.lg,
  },
  noticeText: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 19,
    color: colors.muted,
  },
  noticeStrong: { fontFamily: fonts.semibold, color: colors.text },
  pill: {
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    height: 34,
    justifyContent: 'center',
  },
  pillText: { fontFamily: fonts.regular, fontSize: 13, color: colors.gold },
  disabled: { opacity: 0.45 },
  pressed: { opacity: 0.75 },
  hint: {
    fontFamily: fonts.regular,
    fontSize: 12,
    color: colors.muted,
    marginTop: space.sm,
  },
  error: {
    fontFamily: fonts.regular,
    fontSize: 13,
    color: colors.danger,
    marginTop: space.sm,
  },
});
