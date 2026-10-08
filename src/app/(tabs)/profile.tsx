/** Account, linked wallets, eligibility and security (web: /profile, auth-profile-panel.tsx). */
import { useAppKit } from '@reown/appkit-react-native';
import * as WebBrowser from 'expo-web-browser';
import React, { useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { useAccount, useSignMessage } from 'wagmi';

import {
  Badge,
  Body,
  Button,
  Card,
  Divider,
  Label,
  LoadState,
  Mono,
  Row,
  Screen,
  Segmented,
  Title,
} from '../../components/ui';
import { robinhoodTestnet } from '../../config/chains';
import * as api from '../../lib/api';
import { formatDate, shortAddress } from '../../lib/format';
import { useSession, useUser } from '../../lib/session';
import type { KycStatus, User } from '../../lib/types';
import { colors, space, type } from '../../theme/tokens';

type Tab = 'account' | 'wallets' | 'eligibility' | 'security';

const TABS = [
  { value: 'account', label: 'Account' },
  { value: 'wallets', label: 'Wallets' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'security', label: 'Security' },
] as const;

export default function ProfileScreen() {
  const user = useUser();
  const [tab, setTab] = useState<Tab>('account');
  return (
    <Screen>
      <View style={styles.title}>
        <Title>{user.displayName ?? user.email}</Title>
        <Text style={[type.small, { color: colors.muted }]}>{user.email}</Text>
      </View>
      <Segmented options={TABS} value={tab} onChange={setTab} />
      {tab === 'account' && <Account user={user} />}
      {tab === 'wallets' && <Wallets user={user} />}
      {tab === 'eligibility' && <EligibilityTab user={user} />}
      {tab === 'security' && <Security user={user} />}
    </Screen>
  );
}

function Account({ user }: { user: User }) {
  const { signOut } = useSession();
  const [error, setError] = useState<string>();
  return (
    <>
      <Card title="Personal details" banded>
        <Row label="First name" value={user.firstName ?? '—'} mono={false} />
        <Row label="Last name" value={user.lastName ?? '—'} mono={false} />
        <Row label="Country" value={user.country ?? '—'} mono={false} />
        <Row label="Email" value={user.email} mono={false} />
        <Row
          label="Member since"
          value={formatDate(user.createdAt)}
          mono={false}
        />
      </Card>
      {error ? (
        <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
      ) : null}
      <Button
        label="Sign out"
        variant="outline"
        onPress={() => {
          setError(undefined);
          signOut().catch(e =>
            setError(e instanceof Error ? e.message : 'Sign-out failed.'),
          );
        }}
      />
    </>
  );
}

/**
 * Connecting a wallet in AppKit does NOT link it — the backend must verify a
 * challenge signature first (`/auth/wallet/challenge` → personal_sign →
 * `/auth/wallet/verify`). Only verified wallets appear in the list.
 */
function Wallets({ user }: { user: User }) {
  const { setUser } = useSession();
  const { open } = useAppKit();
  const { address, isConnected, chainId } = useAccount();
  const { signMessageAsync } = useSignMessage();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string>();
  const [notice, setNotice] = useState<string>();

  // The chain the linked wallet must be on: the API's first supported chain.
  const { data: chains } = api.useLoad(api.listChains, 'chains');
  const expectedChainId = chains?.[0]?.chainId || robinhoodTestnet.id;
  const expectedName =
    chains?.[0]?.name ?? robinhoodTestnet.name ?? `chain ${expectedChainId}`;

  const wrongNetwork =
    isConnected && chainId !== undefined && chainId !== expectedChainId;

  const link = async () => {
    if (!address) return;
    setBusy('link');
    setError(undefined);
    setNotice(undefined);
    try {
      if (chainId !== expectedChainId) {
        throw new Error(
          `Switch your wallet to ${expectedName} before linking.`,
        );
      }
      const challenge = await api.requestWalletChallenge(address);
      const signature = await signMessageAsync({
        account: address as `0x${string}`,
        message: challenge.message,
      });
      setUser(
        await api.verifyWalletLink({
          message: challenge.message,
          signature,
          chainId: expectedChainId,
        }),
      );
      setNotice('Wallet verified and linked.');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Wallet verification failed.');
    } finally {
      setBusy(null);
    }
  };

  const makePrimary = async (wallet: string) => {
    setBusy(`primary:${wallet}`);
    setError(undefined);
    try {
      setUser(await api.setPrimaryWallet(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not set primary.');
    } finally {
      setBusy(null);
    }
  };

  const remove = async (wallet: string) => {
    setBusy(`remove:${wallet}`);
    setError(undefined);
    try {
      setUser(await api.removeWallet(wallet));
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not remove the wallet.');
    } finally {
      setBusy(null);
    }
  };

  const connectedLinked = Boolean(
    address &&
    user.wallets.some(w => w.address.toLowerCase() === address.toLowerCase()),
  );

  return (
    <Card title="Linked wallets" banded>
      <Body muted>
        A linked wallet holds your basket shares and signs your transactions. It
        does not sign you in.
      </Body>

      {user.wallets.length === 0 ? (
        <Text style={[type.small, { color: colors.muted }]}>
          No wallets linked yet.
        </Text>
      ) : (
        user.wallets.map((wallet, i) => (
          <View key={wallet.address} style={{ gap: space.xs }}>
            {i > 0 && <Divider />}
            <View style={styles.line}>
              <Mono>{shortAddress(wallet.address)}</Mono>
              {wallet.primary ? <Badge label="Primary" tone="gold" /> : null}
            </View>
            <Text style={[type.small, { color: colors.muted }]}>
              Chain {wallet.chainId}
            </Text>
            <View style={styles.walletActions}>
              {!wallet.primary && (
                <Button
                  label="Make primary"
                  variant="outline"
                  style={styles.walletAction}
                  loading={busy === `primary:${wallet.address}`}
                  disabled={busy !== null}
                  onPress={() => makePrimary(wallet.address)}
                />
              )}
              <Button
                label="Remove"
                variant="ghost"
                style={styles.walletAction}
                loading={busy === `remove:${wallet.address}`}
                disabled={busy !== null}
                onPress={() => remove(wallet.address)}
              />
            </View>
          </View>
        ))
      )}

      {wrongNetwork && (
        <Body muted>
          Your wallet is on a different network. Switch to {expectedName} to
          link it.
        </Body>
      )}
      {notice ? (
        <Text style={[type.small, { color: colors.green }]}>{notice}</Text>
      ) : null}
      {error ? (
        <Text style={[type.small, { color: colors.danger }]}>{error}</Text>
      ) : null}

      <Button
        label={isConnected ? 'Choose another wallet' : 'Connect wallet'}
        variant="outline"
        onPress={open}
      />
      <Button
        label={
          isConnected && connectedLinked
            ? 'Connected wallet already linked'
            : 'Sign to link connected wallet'
        }
        variant="green"
        onPress={link}
        loading={busy === 'link'}
        disabled={!isConnected || !address || connectedLinked || busy !== null}
      />
    </Card>
  );
}

const KYC: Record<
  KycStatus,
  { label: string; tone: 'green' | 'gold' | 'neutral' | 'danger' }
> = {
  not_started: { label: 'Not started', tone: 'neutral' },
  pending: { label: 'Pending', tone: 'gold' },
  verified: { label: 'Verified', tone: 'green' },
  rejected: { label: 'Rejected', tone: 'danger' },
};

function EligibilityTab({ user }: { user: User }) {
  const wallet =
    user.wallets.find(w => w.primary)?.address ??
    user.walletAddress ??
    user.wallets[0]?.address ??
    null;
  const { data, error, reload } = api.useLoad(
    () => api.getEligibility(wallet),
    wallet ?? 'none',
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
        await WebBrowser.openBrowserAsync(session.url);
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
  const kyc = KYC[data.kycStatus];
  return (
    <Card title="Eligibility" banded>
      <Body muted>
        Open baskets need only a linked wallet. Permissioned baskets also need
        identity verification for the wallet that will hold the shares.
      </Body>
      <Row
        label="Verification"
        value={<Badge label={kyc.label} tone={kyc.tone} />}
      />
      <Row label="Provider" value={data.provider} mono={false} />
      <Row
        label="Verified"
        value={data.verifiedAt ? formatDate(data.verifiedAt) : '—'}
        mono={false}
      />
      <Row
        label="Permissioned baskets"
        value={
          <Badge
            label={data.permissionedAccess ? 'Allowed' : 'Not yet'}
            tone={data.permissionedAccess ? 'green' : 'neutral'}
          />
        }
      />
      {kycError ? (
        <Text style={[type.small, { color: colors.danger }]}>{kycError}</Text>
      ) : null}
      {!wallet ? (
        <Body muted>Link a wallet before starting verification.</Body>
      ) : (
        data.kycStatus !== 'verified' && (
          <Button
            label={
              data.kycStatus === 'pending'
                ? 'Continue verification'
                : 'Start verification'
            }
            variant="outline"
            onPress={startVerification}
            loading={busy}
          />
        )
      )}
      <Button label="Refresh status" variant="ghost" onPress={reload} />
    </Card>
  );
}

function Security({ user }: { user: User }) {
  const { data, error, reload } = api.useLoad(api.listSessions, 'sessions');
  return (
    <>
      <Card title="Two-factor authentication" banded>
        <Row
          label="Status"
          value={
            <Badge
              label={user.twoFactorEnabled ? 'On' : 'Off'}
              tone={user.twoFactorEnabled ? 'green' : 'neutral'}
            />
          }
        />
        <Body muted>
          Ask for a code from an authenticator app each time you sign in.
        </Body>
        <Button
          label={`${
            user.twoFactorEnabled ? 'Turn off' : 'Set up'
          } · coming soon`}
          variant="outline"
          disabled
        />
      </Card>
      <Card title="Sign-in methods">
        <Row label="Email code" value={<Badge label="On" tone="green" />} />
        <Row label="Google" value={<Badge label="Coming soon" />} />
      </Card>
      <Card title="Active sessions">
        {!data ? (
          <LoadState error={error} onRetry={reload} />
        ) : (
          data.map((session, i) => (
            <View key={session.id} style={{ gap: space.xs }}>
              {i > 0 && <Divider />}
              <View style={styles.line}>
                <Text style={[type.body, { color: colors.text }]}>
                  {session.device}
                </Text>
                {session.current ? <Badge label="Current" tone="gold" /> : null}
              </View>
              <Label>Last active {formatDate(session.lastActive)}</Label>
            </View>
          ))
        )}
        <Body muted>
          Signing out on this device ends the session shown here.
        </Body>
      </Card>
    </>
  );
}

const styles = StyleSheet.create({
  title: { gap: 2 },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.md,
  },
  walletActions: { flexDirection: 'row', gap: space.sm },
  walletAction: { flex: 1, minHeight: 38 },
});
