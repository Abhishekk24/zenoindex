/**
 * Explore (home): browse, search and filter baskets (design: Explore mockup;
 * web: /products, product-explore.tsx).
 *
 * Tabs: All · Open · Permissioned list the baskets as they are; Custom holds
 * the filters — strategy chips and the Sort bar (design).
 * Header actions: strategy opens Custom; manager opens its chips under the
 * tabs (a gold ring marks an applied filter); search opens /search.
 * Other screens can open these via ?panel=strategy|manager.
 */
import { Redirect, useLocalSearchParams } from 'expo-router';
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '../../components/AppHeader';
import { BasketCard, openBasket } from '../../components/explore/BasketCard';
import { BasketCardSkeleton } from '../../components/explore/BasketCardSkeleton';
import { ChipRow } from '../../components/explore/ChipRow';
import { HeroBanner } from '../../components/explore/HeroBanner';
import { activeChain } from '../../config/chains';
import {
  ExploreBelowPanels,
  FilterPanel,
} from '../../components/explore/FilterPanel';
import {
  Chip,
  Empty,
  LoadState,
  OptionBar,
  Screen,
  ScreenList,
  SwipeTabContent,
  UnderlineTabs,
} from '../../components/ui';
import { useLoad } from '../../hooks/useLoad';
import { useReloadOnRefocus } from '../../hooks/useReloadOnRefocus';
import * as api from '../../lib/api';
import { useAppMode } from '../../lib/appMode';
import { assetMap, isPermissioned, strategyOf } from '../../lib/basket';
import { compare } from '../../lib/decimal';
import type { Dtf } from '../../lib/types';
import { humanize, shortAddress } from '../../lib/format';
import { colors, fonts, space } from '../../theme/tokens';

type Access = 'all' | 'open' | 'permissioned' | 'custom';
type Panel = 'manager' | null;
type Sort = 'aum' | 'return30d' | 'newest' | 'fee';

const SORTS = [
  { value: 'aum', label: 'AUM' },
  { value: 'return30d', label: 'Return' },
  { value: 'newest', label: 'Newest' },
  { value: 'fee', label: 'Fee' },
] as const;

/**
 * Orders baskets for the Custom tab's sort. The API gives no creation date,
 * so Newest keeps the API's own order (agreed until it sends one).
 */
function sortBaskets(dtfs: Dtf[], sort: Sort): Dtf[] {
  if (sort === 'newest') return dtfs;
  return [...dtfs].sort((a, b) => {
    switch (sort) {
      case 'aum':
        return compare(b.aum, a.aum);
      case 'fee':
        return a.fees.managementBps - b.fees.managementBps;
      default:
        // Return: best 30 days first; baskets without history last.
        return (
          (b.stats?.change30dBps ?? -Infinity) -
          (a.stats?.change30dBps ?? -Infinity)
        );
    }
  });
}

const ACCESS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'permissioned', label: 'Permissioned' },
  { value: 'custom', label: 'Custom' },
] as const;

/** Baskets plus the asset list (for symbols and access policy). */
async function loadExplore() {
  const [dtfs, assets] = await Promise.all([api.listDtfs(), api.listAssets()]);
  return { dtfs, assets };
}

function asPanel(value: string | undefined): Panel {
  return value === 'manager' ? value : null;
}

export default function ExploreScreen() {
  const params = useLocalSearchParams<{ panel?: string; at?: string }>();
  const { data, error, loading, reload } = useLoad(loadExplore, 'explore');
  useReloadOnRefocus(reload);
  const { mode } = useAppMode();
  const [access, setAccess] = useState<Access>(
    params.panel === 'strategy' ? 'custom' : 'all',
  );
  const [manager, setManager] = useState<string>();
  const [strategy, setStrategy] = useState<string>();
  const [panel, setPanel] = useState<Panel>(asPanel(params.panel));
  const [sort, setSort] = useState<Sort>('aum');

  // Arriving from another screen's filter button: open that panel. Tracked
  // during render (not in an effect) so it applies on the same frame.
  const request = `${params.panel ?? ''}#${params.at ?? ''}`;
  const [handled, setHandled] = useState(request);
  if (request !== handled) {
    setHandled(request);
    if (params.panel === 'strategy') setAccess('custom');
    else if (asPanel(params.panel)) setPanel(asPanel(params.panel));
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

  // Strategy and sort belong to the Custom tab; the manager filter to all.
  const custom = access === 'custom';
  const visible = useMemo(() => {
    const shown = dtfs.filter(dtf => {
      const permissioned = isPermissioned(dtf, assets);
      if (access === 'open' && permissioned) return false;
      if (access === 'permissioned' && !permissioned) return false;
      if (manager && dtf.manager !== manager) return false;
      if (custom && strategy && strategyOf(dtf) !== strategy) return false;
      return true;
    });
    return custom ? sortBaskets(shown, sort) : shown;
  }, [dtfs, assets, access, custom, manager, strategy, sort]);

  const filtered = Boolean(manager || (custom && strategy));
  const clear = () => {
    setManager(undefined);
    setStrategy(undefined);
    setPanel(null);
  };
  const toggleManager = () =>
    setPanel(current => (current === 'manager' ? null : 'manager'));

  // Manager mode has no Explore tab: its home is Baskets.
  if (mode === 'manager') return <Redirect href="/baskets" />;

  return (
    <View style={styles.root}>
      <AppHeader
        title="Explore baskets"
        strategyActive={custom}
        managerActive={Boolean(manager) || panel === 'manager'}
        onStrategy={() => setAccess('custom')}
        onManager={toggleManager}
      />

      <View style={styles.tabs}>
        <UnderlineTabs options={ACCESS} value={access} onChange={setAccess} />
      </View>

      {panel === 'manager' && (
        <FilterPanel>
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
        </FilterPanel>
      )}
      <ExploreBelowPanels style={styles.below}>
        {custom && (
          <FilterPanel>
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
            <OptionBar
              label="Sort"
              options={SORTS}
              value={sort}
              onChange={setSort}
              style={styles.sort}
            />
          </FilterPanel>
        )}
        {filtered && (
          <FilterPanel>
            <Pressable
              onPress={clear}
              accessibilityRole="button"
              style={styles.clear}
            >
              <Text style={styles.clearText}>
                {visible.length} of {dtfs.length} · Clear filters
              </Text>
            </Pressable>
          </FilterPanel>
        )}

        {!data && error ? (
          <LoadState error={error} onRetry={reload} />
        ) : !data ? (
          // First load: the cards' outlines, not a spinner.
          <Screen tabBar>
            <View style={styles.list}>
              {[0, 1, 2].map(i => (
                <BasketCardSkeleton key={i} />
              ))}
            </View>
          </Screen>
        ) : (
          <SwipeTabContent
            index={ACCESS.findIndex(a => a.value === access)}
            count={ACCESS.length}
            onIndexChange={i => setAccess(ACCESS[i]!.value)}
            style={styles.below}
          >
            <ScreenList
              tabBar
              onRefresh={reload}
              refreshing={loading}
              data={visible}
              keyExtractor={dtf => dtf.id}
              renderItem={({ item }) => (
                <BasketCard dtf={item} assets={assets} onPress={openBasket} />
              )}
              ListHeaderComponent={
                access === 'all' && !filtered ? (
                  <HeroBanner chainName={activeChain.name} />
                ) : undefined
              }
              ListEmptyComponent={
                dtfs.length === 0 ? (
                  <Empty
                    title="No baskets are listed yet"
                    body="Listed baskets appear here as soon as a manager publishes one."
                  />
                ) : (
                  <Empty
                    title="No baskets match these filters"
                    body="Try another tab, or adjust the search, manager or strategy filters."
                  />
                )
              }
            />
          </SwipeTabContent>
        )}
      </ExploreBelowPanels>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  below: { flex: 1 },
  list: { gap: space.lg },
  sort: { marginHorizontal: space.lg, marginTop: space.md },
  tabs: { marginTop: space.lg, paddingHorizontal: space.md },
  clear: { paddingHorizontal: space.lg, paddingTop: space.md },
  clearText: { fontFamily: fonts.medium, fontSize: 13, color: colors.gold },
});
