/**
 * Search baskets by name, symbol or manager (design: Search mockup).
 * Opened from the magnifier on Explore; the field is focused on arrival.
 * Before anything is typed (or while baskets load) a placeholder card shows.
 */
import { router } from 'expo-router';
import React, { useMemo, useState } from 'react';
import {
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { SearchIcon } from '../components/icons';
import { SkeletonCard } from '../components/search/SkeletonCard';
import * as api from '../lib/api';
import { shortAddress } from '../lib/format';
import type { Dtf } from '../lib/types';
import { useLoad } from '../hooks/useLoad';
import { colors, fonts, radius, space } from '../theme/tokens';

function matches(dtf: Dtf, q: string): boolean {
  return (
    dtf.name.toLowerCase().includes(q) ||
    dtf.symbol.toLowerCase().includes(q) ||
    dtf.manager.toLowerCase().includes(q)
  );
}

/** Managers are either a name or a 0x address; only addresses get shortened. */
function managerLabel(manager: string): string {
  return /^0x[0-9a-fA-F]{40}$/.test(manager) ? shortAddress(manager) : manager;
}

export default function SearchScreen() {
  const insets = useSafeAreaInsets();
  const [query, setQuery] = useState('');
  const { data, error, reload } = useLoad(api.listDtfs, 'search-dtfs');

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q && data ? data.filter(dtf => matches(dtf, q)) : []),
    [data, q],
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Search" actions={false} />

      <View style={styles.field}>
        <SearchIcon color={colors.muted} size={16} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Search by name, symbol or manager"
          placeholderTextColor={colors.dim}
          selectionColor={colors.green}
          cursorColor={colors.green}
          autoFocus
          autoCapitalize="none"
          autoCorrect={false}
          returnKeyType="search"
          clearButtonMode="while-editing"
          style={styles.input}
          accessibilityLabel="Search baskets"
        />
      </View>

      <ScrollView
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
      >
        {error && !data ? (
          <Pressable onPress={reload} accessibilityRole="button">
            <Text style={styles.message}>
              {error} <Text style={styles.retry}>Try again</Text>
            </Text>
          </Pressable>
        ) : !q || !data ? (
          <SkeletonCard />
        ) : results.length === 0 ? (
          <Text style={styles.message}>No baskets match “{query.trim()}”.</Text>
        ) : (
          results.map(dtf => (
            <Pressable
              key={dtf.id}
              onPress={() =>
                router.push({
                  pathname: '/basket/[id]',
                  params: { id: dtf.id },
                })
              }
              accessibilityRole="button"
              accessibilityLabel={`${dtf.name}, ${dtf.symbol}`}
              style={({ pressed }) => [styles.row, pressed && styles.pressed]}
            >
              <Text style={styles.name} numberOfLines={1}>
                {dtf.name}
              </Text>
              <Text style={styles.meta} numberOfLines={1}>
                {dtf.symbol} · {managerLabel(dtf.manager)}
              </Text>
            </Pressable>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  field: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.lg,
    marginHorizontal: space.md,
    paddingHorizontal: space.lg,
    borderBottomWidth: 1,
    borderBottomColor: colors.lineStrong,
  },
  input: {
    flex: 1,
    height: 52,
    fontFamily: fonts.regular,
    fontSize: 16,
    color: colors.text,
  },
  list: { padding: space.md, paddingTop: space.lg, gap: space.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: colors.surface2 },
  name: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  meta: {
    fontFamily: fonts.regular,
    fontSize: 11,
    color: colors.muted,
    marginTop: 6,
  },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: space.xs,
  },
  retry: { fontFamily: fonts.medium, color: colors.gold },
});
