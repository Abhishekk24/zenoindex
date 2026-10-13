/**
 * Account, linked wallets, eligibility and security (design: Profile mockups;
 * web: /profile, auth-profile-panel.tsx). Pull down to refresh.
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { AccountTab } from '../../components/profile/AccountTab';
import { EligibilityTab } from '../../components/profile/EligibilityTab';
import { SecurityTab } from '../../components/profile/SecurityTab';
import { WalletsTab } from '../../components/profile/WalletsTab';
import { Screen, SwipeTabContent, UnderlineTabs } from '../../components/ui';
import { useSession } from '../../hooks/useSession';
import { useUser } from '../../hooks/useUser';
import { colors, space } from '../../theme/tokens';

type Tab = 'account' | 'wallets' | 'eligibility' | 'security';

const TABS = [
  { value: 'account', label: 'Account' },
  { value: 'wallets', label: 'Wallets' },
  { value: 'eligibility', label: 'Eligibility' },
  { value: 'security', label: 'Security' },
] as const;

export default function ProfileScreen() {
  const user = useUser();
  const { refresh } = useSession();
  const [tab, setTab] = useState<Tab>('account');
  // Bumped by pull-to-refresh; tabs include it in their load keys.
  const [refreshKey, setRefreshKey] = useState(0);

  const onRefresh = () => {
    setRefreshKey(k => k + 1);
    refresh().catch(() => {
      // Keep the current account if /auth/me can't be reached.
    });
  };

  return (
    <View style={styles.root}>
      <AppHeader title="Profile" onEdit={() => router.push('/edit-profile')} />
      <View style={styles.tabs}>
        <UnderlineTabs options={TABS} value={tab} onChange={setTab} />
      </View>
      <Screen tabBar onRefresh={onRefresh}>
        <SwipeTabContent
          index={TABS.findIndex(t => t.value === tab)}
          count={TABS.length}
          onIndexChange={i => setTab(TABS[i]!.value)}
        >
          {tab === 'account' && <AccountTab user={user} />}
          {tab === 'wallets' && <WalletsTab user={user} />}
          {tab === 'eligibility' && (
            <EligibilityTab user={user} refreshKey={refreshKey} />
          )}
          {tab === 'security' && (
            <SecurityTab user={user} refreshKey={refreshKey} />
          )}
        </SwipeTabContent>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { marginTop: space.lg, paddingHorizontal: space.md },
});
