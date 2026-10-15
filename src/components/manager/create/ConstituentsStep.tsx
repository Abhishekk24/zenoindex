/**
 * Create step 3, Constituents (design): base asset, search-and-add target
 * assets, a weight per asset, and the running total (must reach 100.00% with
 * at least 2 assets to continue).
 */
import React, { useMemo, useState } from 'react';
import { Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import {
  CREATE_ASSETS,
  assetOf,
  totalWeight,
  type CreateForm,
} from '../../../manager/createBasket';
import { colors, fonts, space } from '../../../theme/tokens';
import { FIELD_BG, SelectField } from './Fields';

const BLUE = '#5aa9e6';

export function ConstituentsStep({
  form,
  update,
  providerLabel,
  baseError,
}: {
  form: CreateForm;
  update: (patch: Partial<CreateForm>) => void;
  /** e.g. "Robinhood" → "Robinhood token" over the table. */
  providerLabel: string;
  baseError?: string;
}) {
  const [query, setQuery] = useState('');
  const [picked, setPicked] = useState<string>();

  const taken = useMemo(
    () => new Set([form.baseAssetId, ...form.constituents.map(c => c.assetId)]),
    [form],
  );
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q || picked) return [];
    return CREATE_ASSETS.filter(
      a =>
        a.mode === 'in-kind' &&
        !taken.has(a.id) &&
        (a.name.toLowerCase().includes(q) ||
          a.symbol.toLowerCase().includes(q)),
    ).slice(0, 5);
  }, [query, picked, taken]);

  const add = () => {
    const id = picked ?? (matches.length === 1 ? matches[0]!.id : undefined);
    if (!id) return;
    update({
      constituents: [...form.constituents, { assetId: id, weight: '' }],
    });
    setQuery('');
    setPicked(undefined);
  };

  const setWeight = (assetId: string, text: string) =>
    update({
      constituents: form.constituents.map(c =>
        c.assetId === assetId
          ? { ...c, weight: text.replace(',', '.').replace(/[^\d.]/g, '') }
          : c,
      ),
    });

  const remove = (assetId: string) =>
    update({
      constituents: form.constituents.filter(c => c.assetId !== assetId),
    });

  const total = totalWeight(form);
  const left = Math.max(0, 100 - total);
  const complete = Math.abs(total - 100) < 0.001;
  const over = total > 100.001;

  return (
    <View style={styles.root}>
      <SelectField
        label="Base Asset"
        value={form.baseAssetId}
        placeholder="Enter name"
        chevron={false}
        options={CREATE_ASSETS.filter(a => a.mode === 'zap').map(a => ({
          value: a.id,
          label: `${a.name} (${a.symbol})`,
        }))}
        onChange={baseAssetId => update({ baseAssetId })}
        error={baseError}
      />

      <View style={styles.field}>
        <Text style={styles.label}>Target Asset</Text>
        <View style={styles.search}>
          <TextInput
            value={query}
            onChangeText={text => {
              setQuery(text);
              setPicked(undefined);
            }}
            placeholder="Search and select asset"
            placeholderTextColor={colors.dim}
            selectionColor={colors.gold}
            style={styles.searchInput}
            accessibilityLabel="Search target asset"
            returnKeyType="done"
            onSubmitEditing={add}
          />
          <Pressable
            onPress={add}
            disabled={!picked && matches.length !== 1}
            accessibilityRole="button"
            accessibilityLabel="Add asset"
            style={({ pressed }) => [
              styles.add,
              !picked && matches.length !== 1 && styles.addDisabled,
              pressed && styles.pressed,
            ]}
          >
            <Text style={styles.addText}>Add</Text>
          </Pressable>
        </View>
        {matches.length > 0 ? (
          <View style={styles.matches}>
            {matches.map(a => (
              <Pressable
                key={a.id}
                onPress={() => {
                  setPicked(a.id);
                  setQuery(a.name);
                }}
                accessibilityRole="button"
                style={({ pressed }) => [
                  styles.match,
                  pressed && styles.matchPressed,
                ]}
              >
                <Text style={styles.matchName}>{a.name}</Text>
                <Text style={styles.matchSymbol}>{a.symbol}</Text>
              </Pressable>
            ))}
          </View>
        ) : null}
      </View>

      {form.constituents.length > 0 ? (
        <View style={styles.table}>
          <View style={styles.tableTop}>
            <Text style={styles.tableTitle}>SELECTED ASSET DETAILS</Text>
            <Text style={styles.tableNote}>{providerLabel} token</Text>
          </View>
          <View style={styles.tableHead}>
            <Text style={styles.headText}>ASSET</Text>
            <Text style={styles.headText}>WEIGHT</Text>
          </View>
          {form.constituents.map(c => (
            <View key={c.assetId} style={styles.row}>
              <Text style={styles.assetName}>
                {assetOf(c.assetId)?.name ?? c.assetId}
              </Text>
              <TextInput
                value={c.weight}
                onChangeText={text => setWeight(c.assetId, text)}
                keyboardType="decimal-pad"
                placeholder="0"
                placeholderTextColor={colors.dim}
                selectionColor={colors.gold}
                style={styles.weight}
                accessibilityLabel={`${assetOf(c.assetId)?.name} weight, percent`}
              />
              <Pressable
                onPress={() => remove(c.assetId)}
                accessibilityRole="button"
                accessibilityLabel={`Remove ${assetOf(c.assetId)?.name}`}
                hitSlop={6}
                style={styles.remove}
              >
                <Text style={styles.removeText}>×</Text>
              </Pressable>
            </View>
          ))}
        </View>
      ) : null}

      <View style={styles.spacer} />

      <View style={[styles.total, over && styles.totalOver]}>
        <View style={styles.totalText}>
          <Text style={[styles.totalLine, over && styles.overText]}>
            Weights total {total.toFixed(2)}%
          </Text>
          <Text style={[styles.totalLine, over && styles.overText]}>
            {complete
              ? 'Ready to continue.'
              : over
                ? `* remove ${(total - 100).toFixed(2)}% to continue.`
                : `* add ${left.toFixed(2)}% to continue.`}
          </Text>
        </View>
        <Text style={[styles.totalFigure, over && styles.overText]}>
          {total.toFixed(2)} / 100.00
        </Text>
      </View>

      {form.constituents.length < 2 ? (
        <View style={styles.info}>
          <Text style={styles.infoText}>
            Add at least 2 constituents to create a DTF.
          </Text>
        </View>
      ) : null}
    </View>
  );
}

const GOLD_TINT = 'rgba(205, 182, 121, 0.08)';

const styles = StyleSheet.create({
  root: { gap: space.xl, flexGrow: 1 },
  field: { gap: 10 },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  search: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.line,
    paddingLeft: 16,
    paddingRight: 4,
    minHeight: 46,
  },
  searchInput: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  add: {
    backgroundColor: colors.gold,
    borderRadius: 8,
    paddingHorizontal: 16,
    paddingVertical: 8,
  },
  addDisabled: { opacity: 0.55 },
  pressed: { opacity: 0.8 },
  addText: { fontFamily: fonts.medium, fontSize: 15, color: colors.onGold },
  matches: {
    backgroundColor: FIELD_BG,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
  },
  match: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: colors.line,
  },
  matchPressed: { backgroundColor: colors.surface3 },
  matchName: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  matchSymbol: { fontFamily: fonts.mono, fontSize: 13, color: colors.muted },
  table: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    overflow: 'hidden',
  },
  tableTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 16,
  },
  tableTitle: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 1,
    color: colors.gold,
  },
  tableNote: { fontFamily: fonts.regular, fontSize: 13, color: colors.muted },
  tableHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    backgroundColor: colors.surface3,
    paddingHorizontal: 20,
    paddingVertical: 12,
  },
  headText: {
    fontFamily: fonts.medium,
    fontSize: 12,
    letterSpacing: 0.8,
    color: colors.muted,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: colors.line,
  },
  assetName: {
    flex: 1,
    fontFamily: fonts.regular,
    fontSize: 15,
    color: colors.text,
  },
  weight: {
    width: 46,
    height: 44,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: colors.lineStrong,
    backgroundColor: '#050706',
    textAlign: 'center',
    fontFamily: fonts.regular,
    fontSize: 17,
    color: colors.text,
  },
  remove: {
    width: 40,
    height: 44,
    borderRadius: 6,
    backgroundColor: colors.surface2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  removeText: { fontFamily: fonts.regular, fontSize: 18, color: colors.muted },
  spacer: { flexGrow: 1, minHeight: space.lg },
  total: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: colors.goldLine,
    backgroundColor: GOLD_TINT,
    paddingHorizontal: 16,
    paddingVertical: 14,
  },
  totalOver: { borderColor: colors.danger, backgroundColor: colors.dangerSoft },
  totalText: { flex: 1, gap: 2 },
  totalLine: { fontFamily: fonts.regular, fontSize: 14, color: colors.gold },
  totalFigure: { fontFamily: fonts.regular, fontSize: 14, color: colors.gold },
  overText: { color: colors.danger },
  info: {
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(90, 169, 230, 0.35)',
    backgroundColor: 'rgba(90, 169, 230, 0.08)',
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  infoText: { fontFamily: fonts.regular, fontSize: 14, color: BLUE },
});
