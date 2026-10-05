/** Browse, search and filter baskets (web: /products, product-explore.tsx). */
import React, { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BasketCard } from '../components/BasketCard';
import {
  Button,
  Chip,
  Empty,
  Label,
  LoadState,
  Screen,
  Segmented,
} from '../components/ui';
import * as api from '../lib/api';
import { assetMap, isPermissioned, strategyOf } from '../lib/basket';
import { humanize, shortAddress } from '../lib/format';
import type { TabScreenProps } from '../navigation/types';
import { colors, radius, space, type } from '../theme/tokens';

type Access = 'all' | 'open' | 'permissioned';

const ACCESS = [
  { value: 'all', label: 'All' },
  { value: 'open', label: 'Open' },
  { value: 'permissioned', label: 'Permissioned' },
] as const;

export function ExploreScreen({ navigation }: TabScreenProps<'Explore'>) {
  const { data, error, loading, reload } = useLoad();
  const [query, setQuery] = useState('');
  const [access, setAccess] = useState<Access>('all');
  const [manager, setManager] = useState<string>();
  const [strategy, setStrategy] = useState<string>();

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
    const q = query.trim().toLowerCase();
    return dtfs.filter(dtf => {
      if (
        q &&
        !dtf.name.toLowerCase().includes(q) &&
        !dtf.symbol.toLowerCase().includes(q) &&
        !dtf.manager.toLowerCase().includes(q)
      ) {
        return false;
      }
      const permissioned = isPermissioned(dtf, assets);
      if (access === 'open' && permissioned) return false;
      if (access === 'permissioned' && !permissioned) return false;
      if (manager && dtf.manager !== manager) return false;
      if (strategy && strategyOf(dtf) !== strategy) return false;
      return true;
    });
  }, [dtfs, assets, query, access, manager, strategy]);

  const filtered = Boolean(query || access !== 'all' || manager || strategy);
  const clear = () => {
    setQuery('');
    setAccess('all');
    setManager(undefined);
    setStrategy(undefined);
  };

  if (!data) return <LoadState error={error} onRetry={reload} />;

  return (
    <Screen onRefresh={reload} refreshing={loading}>
      <Text style={[type.body, { color: colors.muted }]}>
        Open-access baskets need only a linked wallet. Permissioned baskets
        check your eligibility before you invest.
      </Text>

      <TextInput
        value={query}
        onChangeText={setQuery}
        placeholder="Search by name, symbol or manager"
        placeholderTextColor={colors.dim}
        selectionColor={colors.gold}
        autoCapitalize="none"
        autoCorrect={false}
        clearButtonMode="while-editing"
        style={styles.search}
      />

      <Segmented options={ACCESS} value={access} onChange={setAccess} />

      <FilterRow label="Manager">
        {managers.map(m => (
          <Chip
            key={m}
            label={shortAddress(m)}
            selected={manager === m}
            onPress={() => setManager(manager === m ? undefined : m)}
          />
        ))}
      </FilterRow>
      <FilterRow label="Strategy">
        {strategies.map(s => (
          <Chip
            key={s}
            label={humanize(s)}
            selected={strategy === s}
            onPress={() => setStrategy(strategy === s ? undefined : s)}
          />
        ))}
      </FilterRow>

      <View style={styles.count}>
        <Label>
          {visible.length} of {dtfs.length} baskets
        </Label>
        {filtered ? (
          <Button label="Clear filters" variant="ghost" onPress={clear} />
        ) : null}
      </View>

      {dtfs.length === 0 ? (
        <Empty
          title="No baskets are listed yet"
          body="Listed baskets appear here as soon as a manager publishes one."
        />
      ) : visible.length === 0 ? (
        <Empty
          title="No baskets match these filters"
          body="Try adjusting the search, access, manager or strategy filters."
        />
      ) : (
        visible.map(dtf => (
          <BasketCard
            key={dtf.id}
            dtf={dtf}
            assets={assets}
            onPress={() => navigation.navigate('Basket', { id: dtf.id })}
          />
        ))
      )}
    </Screen>
  );
}

function useLoad() {
  return api.useLoad(async () => {
    const [dtfs, assets] = await Promise.all([
      api.listDtfs(),
      api.listAssets(),
    ]);
    return { dtfs, assets };
  }, 'explore');
}

function FilterRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <View style={{ gap: space.sm }}>
      <Label>{label}</Label>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={{ gap: space.sm }}
      >
        {children}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    ...type.body,
    color: colors.text,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    minHeight: 46,
  },
  count: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
});
