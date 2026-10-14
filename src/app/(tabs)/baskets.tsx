/**
 * Manager mode home: the manager's own baskets (design: Baskets), each with a
 * ⋮ menu (Rebalance, Corporate actions, Fees, Liquidity, Open details).
 * SAMPLE DATA: the API can't list a manager's baskets yet (src/manager/sample.ts).
 * Investor mode has no Baskets tab; it goes back to Explore.
 */
import { Redirect, router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { BasketCard } from '../../components/explore/BasketCard';
import { BasketMenu } from '../../components/manager/BasketMenu';
import {
  Empty,
  Screen,
  SwipeTabContent,
  UnderlineTabs,
} from '../../components/ui';
import { useAppMode } from '../../lib/appMode';
import { isPermissioned } from '../../lib/basket';
import { sampleAssets, sampleBaskets } from '../../manager/sample';
import { colors, space } from '../../theme/tokens';

type Access = 'all' | 'open' | 'permissioned';

const ACCESS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'permissioned', label: 'Permissioned' },
] as const;

export default function ManagerBasketsScreen() {
  const { mode } = useAppMode();
  const [access, setAccess] = useState<Access>('all');

  const visible = useMemo(
    () =>
      sampleBaskets.filter(dtf => {
        const permissioned = isPermissioned(dtf, sampleAssets);
        if (access === 'open') return !permissioned;
        if (access === 'permissioned') return permissioned;
        return true;
      }),
    [access],
  );

  if (mode !== 'manager') return <Redirect href="/" />;

  return (
    <View style={styles.root}>
      <AppHeader title="Baskets" />
      <View style={styles.tabs}>
        <UnderlineTabs options={ACCESS} value={access} onChange={setAccess} />
      </View>
      <Screen tabBar>
        <SwipeTabContent
          index={ACCESS.findIndex(a => a.value === access)}
          count={ACCESS.length}
          onIndexChange={i => setAccess(ACCESS[i]!.value)}
        >
          <View style={styles.list}>
            {visible.length === 0 ? (
              <Empty
                title="No baskets here"
                body="Baskets you create appear here with their NAV, AUM and fees."
              />
            ) : (
              visible.map(dtf => (
                <BasketCard
                  key={dtf.id}
                  dtf={dtf}
                  assets={sampleAssets}
                  onPress={() =>
                    router.push({
                      pathname: '/basket/[id]',
                      params: { id: dtf.id },
                    })
                  }
                  accessory={<BasketMenu id={dtf.id} name={dtf.name} />}
                />
              ))
            )}
          </View>
        </SwipeTabContent>
      </Screen>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  tabs: { marginTop: space.lg, paddingHorizontal: space.md },
  list: { gap: space.lg },
});
