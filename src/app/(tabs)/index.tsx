/**
 * Explore (home): browse, search and filter baskets (design: Explore mockup;
 * web: /products, product-explore.tsx).
 *
 * Header actions: strategy and manager filters open their chips inline under
 * the tabs (a gold ring marks an applied filter); search opens /search.
 * Other screens can open a filter here via ?panel=strategy|manager.
 */
import { router, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { BasketCard } from '../../components/explore/BasketCard';
import { ChipRow } from '../../components/explore/ChipRow';
import {
  Chip,
  Empty,
  LoadState,
  Screen,
  SwipeTabContent,
  UnderlineTabs,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import * as api from '../../lib/api';
import { assetMap, isPermissioned, strategyOf } from '../../lib/basket';
import { compare } from '../../lib/decimal';
import type { Dtf } from '../../lib/types';
import { humanize, shortAddress } from '../../lib/format';
import { colors, fonts, space } from '../../theme/tokens';

type Access = 'all' | 'open' | 'permissioned';
type Panel = 'strategy' | 'manager' | null;
type Sort = 'listed' | 'aum' | 'nav' | 'fee' | 'name';

const SORTS: { value: Sort; label: string }[] = [
  { value: 'listed', label: 'Listed' },
  { value: 'aum', label: 'Largest AUM' },
  { value: 'nav', label: 'NAV / share' },
  { value: 'fee', label: 'Lowest fee' },
  { value: 'name', label: 'Name' },
];

/** Orders baskets for the chosen sort; 'listed' keeps the API's order. */
function sortBaskets(dtfs: Dtf[], sort: Sort): Dtf[] {
  if (sort === 'listed') return dtfs;
  return [...dtfs].sort((a, b) => {
    switch (sort) {
      case 'aum':
        return compare(b.aum, a.aum);
      case 'nav':
        return compare(b.sharePrice, a.sharePrice);
      case 'fee':
        return a.fees.managementBps - b.fees.managementBps;
      default:
        return a.name.localeCompare(b.name);
    }
  });
}

const ACCESS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'permissioned', label: 'Permissioned' },
] as const;

/** Baskets plus the asset list (for symbols and access policy). */
async function loadExplore() {
  const [dtfs, assets] = await Promise.all([api.listDtfs(), api.listAssets()]);
  return { dtfs, assets };
}

function asPanel(value: string | undefined): Panel {
  return value === 'strategy' || value === 'manager' ? value : null;
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ panel?: string; at?: string }>();
  const { data, error, loading, reload } = useLoad(loadExplore, 'explore');
  const [access, setAccess] = useState<Access>('all');
  const [manager, setManager] = useState<string>();
  const [strategy, setStrategy] = useState<string>();
  const [panel, setPanel] = useState<Panel>(asPanel(params.panel));
  const [sort, setSort] = useState<Sort>('listed');

  // Arriving from another screen's filter button: open that panel. Tracked
  // during render (not in an effect) so it applies on the same frame.
  const request = `${params.panel ?? ''}#${params.at ?? ''}`;
  const [handled, setHandled] = useState(request);
  if (request !== handled) {
    setHandled(request);
    if (asPanel(params.panel)) setPanel(asPanel(params.panel));
  }

  const assets = useMemo(() => assetMap(data?.assets ?? []), [data]);
  const dtfs = useMemo(() => data?.dtfs ?? [], [data]);
  const managers = useMemo(
    () => [...new Set(dtfs.map(d => d.manager))].sort(),
    [dtfs],
  );
  const strategies = useMemo(
    () => [...new Set(dtfs.map(strategyOf))].sort(),
    [dtfs],
  );

  const visible = useMemo(() => {
    const shown = dtfs.filter(dtf => {
      const permissioned = isPermissioned(dtf, assets);
      if (access === 'open' && permissioned) return false;
      if (access === 'permissioned' && !permissioned) return false;
      if (manager && dtf.manager !== manager) return false;
      if (strategy && strategyOf(dtf) !== strategy) return false;
      return true;
    });
    return sortBaskets(shown, sort);
  }, [dtfs, assets, access, manager, strategy, sort]);

  const filtered = Boolean(manager || strategy);
  const clear = () => {
    setManager(undefined);
    setStrategy(undefined);
    setPanel(null);
  };
  const toggle = (next: Exclude<Panel, null>) =>
    setPanel(current => (current === next ? null : next));

  return (
    <View style={styles.root}>
      <AppHeader
        title="Explore baskets"
        strategyActive={Boolean(strategy) || panel === 'strategy'}
        managerActive={Boolean(manager) || panel === 'manager'}
        onStrategy={() => toggle('strategy')}
        onManager={() => toggle('manager')}
      />

      <View style={styles.tabs}>
        <UnderlineTabs options={ACCESS} value={access} onChange={setAccess} />
      </View>

      {panel === 'strategy' && (
        <ChipRow>
          {strategies.map(s => (
            <Chip
              key={s}
              label={humanize(s)}
              selected={strategy === s}
              onPress={() => setStrategy(strategy === s ? undefined : s)}
            />
          ))}
        </ChipRow>
      )}
      {panel === 'manager' && (
        <ChipRow>
          {managers.map(m => (
            <Chip
              key={m}
              label={shortAddress(m)}
              selected={manager === m}
              onPress={() => setManager(manager === m ? undefined : m)}
            />
          ))}
        </ChipRow>
      )}
      <ChipRow>
        {SORTS.map(s => (
          <Chip
            key={s.value}
            label={s.label}
            selected={sort === s.value}
            onPress={() => setSort(s.value)}
          />
        ))}
      </ChipRow>
      {filtered && (
        <Pressable
          onPress={clear}
          accessibilityRole="button"
          style={styles.clear}
        >
          <Text style={styles.clearText}>
            {visible.length} of {dtfs.length} · Clear filters
          </Text>
        </Pressable>
      )}

      {!data ? (
        <LoadState error={error} onRetry={reload} />
      ) : (
        <Screen tabBar onRefresh={reload} refreshing={loading}>
          <SwipeTabContent
            index={ACCESS.findIndex(a => a.value === access)}
            count={ACCESS.length}
            onIndexChange={i => setAccess(ACCESS[i]!.value)}
          >
            <View style={styles.list}>
              {dtfs.length === 0 ? (
                <Empty
                  title="No baskets are listed yet"
                  body="Listed baskets appear here as soon as a manager publishes one."
                />
              ) : visible.length === 0 ? (
                <Empty
                  title="No baskets match these filters"
                  body="Try another tab, or adjust the search, manager or strategy filters."
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
                  />
                ))
              )}
            </View>
          </SwipeTabContent>
        </Screen>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  list: { gap: space.lg },
  tabs: { marginTop: space.lg, paddingHorizontal: space.md },
  clear: { paddingHorizontal: space.lg, paddingTop: space.md },
  clearText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold },
});
