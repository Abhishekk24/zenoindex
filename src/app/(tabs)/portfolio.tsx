/**
 * The linked wallet's positions (design: Portfolio mockups; web: /portfolio).
 * Summary card, then Allocation · Holdings · Activities · Performance tabs.
 * Amounts are in the baskets' USD stablecoin base asset, shown with "$".
 */
import { router } from 'expo-router';
import React, { useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { ActivitiesTab } from '../../components/portfolio/ActivitiesTab';
import { AllocationTab } from '../../components/portfolio/AllocationTab';
import { HoldingsTab } from '../../components/portfolio/HoldingsTab';
import { PerformanceTab } from '../../components/portfolio/PerformanceTab';
import { PortfolioSummary } from '../../components/portfolio/PortfolioSummary';
import {
  Button,
  Empty,
  LoadState,
  Screen,
  SwipeTabContent,
  UnderlineTabs,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useUser } from '../../hooks/useUser';
import { sum } from '../../lib/decimal';
import {
  holdingsToday,
  holdingsTrend,
  loadPortfolio,
} from '../../lib/portfolio';
import { primaryWallet } from '../../lib/user';
import { colors } from '../../theme/tokens';

type Tab = 'allocation' | 'holdings' | 'activities' | 'performance';

const TABS = [
  { value: 'allocation', label: 'Allocation' },
  { value: 'holdings', label: 'Holdings' },
  { value: 'activities', label: 'Activities' },
  { value: 'performance', label: 'Performance' },
] as const;

export default function PortfolioScreen() {
  const user = useUser();
  const [tab, setTab] = useState<Tab>('allocation');
  const wallet = primaryWallet(user);

  const { data, error, loading, reload } = useLoad(
    async () => (wallet ? loadPortfolio(wallet) : null),
    wallet ?? 'none',
  );

  const header = <AppHeader title="Portfolio" filters={false} />;

  if (!wallet) {
    return (
      <View style={styles.root}>
        {header}
        <Screen tabBar>
          <Empty
            title="Link a wallet to see your portfolio"
            body="Your baskets are held in your own wallet. Link one from Profile → Wallets."
          />
          <Button
            label="Go to Profile"
            variant="outline"
            onPress={() => router.navigate('/profile')}
          />
        </Screen>
      </View>
    );
  }
  if (!data) {
    return (
      <View style={styles.root}>
        {header}
        <LoadState error={error} onRetry={reload} />
      </View>
    );
  }

  const { portfolio, costBasis, activity, dtfs, source, cash } = data;
  const positions = portfolio.positions;

  if (positions.length === 0) {
    return (
      <View style={styles.root}>
        {header}
        <Screen tabBar onRefresh={reload} refreshing={loading}>
          <Empty
            title="No positions yet"
            body="Baskets you invest in appear here."
          />
          <Button
            label="Explore baskets"
            onPress={() => router.navigate('/')}
          />
        </Screen>
      </View>
    );
  }

  const marketValue = sum(positions.map(p => p.value));
  // Cost basis is only known when the API read model has wallet transactions.
  const hasCost = positions.some(p => costBasis[p.dtfId] !== undefined);
  const cost = sum(positions.map(p => costBasis[p.dtfId] ?? '0'));

  return (
    <View style={styles.root}>
      {header}
      <Screen tabBar onRefresh={reload} refreshing={loading}>
        <PortfolioSummary
          marketValue={marketValue}
          cost={cost}
          hasCost={hasCost}
          baskets={positions.length}
          cash={cash}
          trend={holdingsTrend(positions, dtfs)}
          today={holdingsToday(positions, dtfs)}
        />

        <UnderlineTabs options={TABS} value={tab} onChange={setTab} />

        <SwipeTabContent
          index={TABS.findIndex(t => t.value === tab)}
          count={TABS.length}
          onIndexChange={i => setTab(TABS[i]!.value)}
        >
          {tab === 'allocation' && (
            <AllocationTab
              positions={positions}
              marketValue={marketValue}
              dtfs={dtfs}
            />
          )}
          {tab === 'holdings' && (
            <HoldingsTab
              positions={positions}
              costBasis={costBasis}
              dtfs={dtfs}
            />
          )}
          {tab === 'activities' && (
            <ActivitiesTab activity={activity} dtfs={dtfs} />
          )}
          {tab === 'performance' && (
            <PerformanceTab
              positions={positions}
              dtfs={dtfs}
              indexing={source === 'chain'}
            />
          )}
        </SwipeTabContent>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
});
