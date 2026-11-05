/**
 * Search baskets by name, symbol or manager (design: Search mockup).
 * Opened from the magnifier on Explore; the field is focused on arrival.
 * Before anything is typed, recent searches show as chips (kept on the phone);
 * while baskets load, skeleton rows.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { router } from 'expo-router';
import React, { useEffect, useMemo, useState } from 'react';
import {
  FlatList,
  Keyboard,
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppHeader } from '../components/AppHeader';
import { SearchIcon } from '../components/icons';
import { Chip, Skeleton, SkeletonBar } from '../components/ui';
import * as api from '../lib/api';
import { formatDecimal, formatSignedBps, shortAddress } from '../lib/format';
import type { Dtf } from '../lib/types';
import { useLoad } from '../hooks/useLoad';
import { colors, fonts, radius, space } from '../theme/tokens';

const RECENT_KEY = '@zeno/recent-searches';
const RECENT_MAX = 6;

/** Most recent first, no repeats (case-insensitive). */
function withRecent(recent: string[], query: string): string[] {
  const term = query.trim();
  if (!term) return recent;
  return [
    term,
    ...recent.filter(r => r.toLowerCase() !== term.toLowerCase()),
  ].slice(0, RECENT_MAX);
}

/** Up green, down red, flat or unknown neutral (as on the basket card). */
const changeColor = (bps: number | null) =>
  bps === null || bps === 0
    ? colors.textSecondary
    : bps > 0
      ? colors.green
      : colors.red;

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

  const cancel = () => {
    Keyboard.dismiss();
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const [recent, setRecent] = useState<string[]>([]);
  useEffect(() => {
    AsyncStorage.getItem(RECENT_KEY)
      .then(saved => {
        const list: unknown = saved ? JSON.parse(saved) : [];
        if (Array.isArray(list))
          setRecent(list.filter(r => typeof r === 'string'));
      })
      .catch(() => {});
  }, []);
  const remember = () => {
    const next = withRecent(recent, query);
    if (next === recent) return;
    setRecent(next);
    AsyncStorage.setItem(RECENT_KEY, JSON.stringify(next)).catch(() => {});
  };

  const q = query.trim().toLowerCase();
  const results = useMemo(
    () => (q && data ? data.filter(dtf => matches(dtf, q)) : []),
    [data, q],
  );

  return (
    <View style={styles.root}>
      <AppHeader title="Search" actions={false} onClose={cancel} />

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
          onSubmitEditing={remember}
          clearButtonMode="while-editing"
          style={styles.input}
          accessibilityLabel="Search baskets"
        />
      </View>

      {/* Only the rows near the screen are rendered, however many match. */}
      <FlatList
        data={results}
        keyExtractor={dtf => dtf.id}
        contentContainerStyle={[
          styles.list,
          { paddingBottom: insets.bottom + space.xl },
        ]}
        ItemSeparatorComponent={RowGap}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="on-drag"
        ListEmptyComponent={
          error && !data ? (
            <Pressable onPress={reload} accessibilityRole="button">
              <Text style={styles.message}>
                {error} <Text style={styles.retry}>Try again</Text>
              </Text>
            </Pressable>
          ) : !q ? (
            recent.length > 0 ? (
              <View style={styles.recent}>
                <Text style={styles.recentLabel}>Recent searches</Text>
                <View style={styles.recentChips}>
                  {recent.map(term => (
                    <Chip
                      key={term}
                      label={term}
                      selected={false}
                      onPress={() => setQuery(term)}
                    />
                  ))}
                </View>
              </View>
            ) : undefined
          ) : !data ? (
            <Skeleton style={styles.skeleton}>
              {[0, 1].map(i => (
                <View key={i} style={styles.row}>
                  <SkeletonBar width="45%" height={12} round={6} />
                  <View style={styles.bottom}>
                    <SkeletonBar width="40%" />
                    <SkeletonBar width={90} />
                  </View>
                </View>
              ))}
            </Skeleton>
          ) : (
            <Text style={styles.message}>
              No baskets match “{query.trim()}”.
            </Text>
          )
        }
        renderItem={({ item: dtf }) => (
          <Pressable
            onPress={() => {
              remember();
              router.push({
                pathname: '/basket/[id]',
                params: { id: dtf.id },
              });
            }}
            accessibilityRole="button"
            accessibilityLabel={`${dtf.name}, ${dtf.symbol}`}
            style={({ pressed }) => [styles.row, pressed && styles.pressed]}
          >
            <Text style={styles.name} numberOfLines={1}>
              {dtf.name}
            </Text>
            <View style={styles.bottom}>
              <Text style={[styles.meta, styles.fill]} numberOfLines={1}>
                {dtf.symbol} · {managerLabel(dtf.manager)}
              </Text>
              <Text style={styles.nav}>
                {formatDecimal(dtf.sharePrice, 4)}{' '}
                <Text
                  style={{
                    color: changeColor(dtf.stats?.change30dBps ?? null),
                  }}
                >
                  {dtf.stats?.change30dBps == null
                    ? ''
                    : formatSignedBps(dtf.stats.change30dBps)}
                </Text>
              </Text>
            </View>
          </Pressable>
        )}
      />
    </View>
  );
}

const RowGap = () => <View style={styles.rowGap} />;

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
  // Rows are spaced by RowGap: a gap would also space FlatList's spacers.
  list: { padding: space.md, paddingTop: space.lg },
  rowGap: { height: space.sm },
  row: {
    backgroundColor: colors.surface,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: 14,
  },
  pressed: { backgroundColor: colors.surface2 },
  bottom: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: 6,
  },
  fill: { flex: 1 },
  skeleton: { gap: space.sm },
  recent: { gap: space.md, paddingTop: space.lg },
  recentLabel: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  recentChips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  name: { fontFamily: fonts.regular, fontSize: 16, color: colors.text },
  nav: { fontFamily: fonts.mono, fontSize: 13, color: colors.textSecondary },
  meta: { fontFamily: fonts.regular, fontSize: 11, color: colors.muted },
  message: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.muted,
    paddingHorizontal: space.xs,
  },
  retry: { fontFamily: fonts.medium, color: colors.gold },
});
