/**
 * Manager mode home: the manager's own baskets (design: Baskets), each with a
 * ⋮ menu (Rebalance, Corporate actions, Fees, Liquidity, Open details).
 * Baskets come from GET /manager/dtfs: those whose vault manager (or vault
 * operator) is the signed-in wallet.
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
  LoadState,
  Screen,
  SwipeTabContent,
  UnderlineTabs,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { useAppMode } from '../../lib/appMode';
import { assetMap, isPermissioned } from '../../lib/basket';
import { colors, space } from '../../theme/tokens';

type Access = 'all' | 'open' | 'permissioned';

async function loadManaged() {
  const [dtfs, assets] = await Promise.all([
    api.listManagedDtfs(),
    api.listAssets(),
  ]);
  return { dtfs, assets };
}

const ACCESS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'permissioned', label: 'Permissioned' },
] as const;

export default function ManagerBasketsScreen() {
  const { mode } = useAppMode();
  const [access, setAccess] = useState<Access>('all');
  const { data, error, reload } = useLoad(loadManaged, 'manager-baskets');
  const assets = useMemo(() => assetMap(data?.assets ?? []), [data]);

  const visible = useMemo(
    () =>
      (data?.dtfs ?? []).filter(dtf => {
        const permissioned = isPermissioned(dtf, assets);
        if (access === 'open') return !permissioned;
        if (access === 'permissioned') return permissioned;
        return true;
      }),
    [access, data, assets],
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
            {!data ? (
              <LoadState error={error} onRetry={reload} />
            ) : visible.length === 0 ? (
              <Empty
                title="No baskets here"
                body="Baskets your wallet manages appear here with their NAV, AUM and fees."
              />
            ) : (
              visible.map(dtf => (
                <BasketCard
                  key={dtf.id}
                  dtf={dtf}
                  assets={assets}
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
