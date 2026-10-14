/**
 * Shared frame of the per-basket manager screens (designs: Corporate actions,
 * Fees, Rebalance): ‹ back, the basket's card with its ⋮ menu, then a gold
 * section title with an optional ⓘ and right-hand control.
 */
import { router } from 'expo-router';
import React from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { shortAddress } from '../../lib/format';
import type { Dtf } from '../../lib/types';
import { colors, fonts, radius, space } from '../../theme/tokens';
import { ChevronLeftIcon } from '../icons';
import { Empty, Stripes } from '../ui';
import { BasketMenu } from './BasketMenu';
import { InfoTip } from './InfoTip';

export function BackButton() {
  return (
    <Pressable
      onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={12}
      style={styles.back}
    >
      <ChevronLeftIcon color={colors.text} size={18} />
      <Text style={styles.backText}>back</Text>
    </Pressable>
  );
}

export function ManagerBasketScreen({
  dtf,
  title,
  info,
  right,
  children,
  footer,
}: {
  dtf: Dtf | undefined;
  title: string;
  /** Tooltip text for the ⓘ after the title. */
  info?: string;
  /** Right of the title row, e.g. "Collapse all". */
  right?: React.ReactNode;
  /** Full-bleed content under the title (tables run edge to edge). */
  children: React.ReactNode;
  /** Pinned to the bottom, e.g. Sign and submit. */
  footer?: React.ReactNode;
}) {
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <ScrollView
        contentContainerStyle={{
          paddingTop: insets.top + space.lg,
          paddingBottom: footer ? 140 : insets.bottom + space.xxl,
        }}
      >
        <View style={styles.pad}>
          <BackButton />
          {dtf ? (
            <View style={styles.card}>
              <View style={styles.stripes} pointerEvents="none">
                <Stripes height={84} stripe={2} gap={7} opacity={0.16} />
              </View>
              <View style={styles.cardText}>
                <Text style={styles.name} numberOfLines={1}>
                  {dtf.name}
                </Text>
                <Text style={styles.meta} numberOfLines={1}>
                  {dtf.symbol} · {shortAddress(dtf.manager)}
                </Text>
              </View>
              <BasketMenu id={dtf.id} name={dtf.name} />
            </View>
          ) : null}
        </View>

        {dtf ? (
          <>
            <View style={[styles.pad, styles.titleRow]}>
              <View style={styles.titleLeft}>
                <Text style={styles.title} accessibilityRole="header">
                  {title}
                </Text>
                {info ? <InfoTip text={info} label={title} /> : null}
              </View>
              {right}
            </View>
            {children}
          </>
        ) : (
          <View style={styles.pad}>
            <Empty
              title="Basket not found"
              body="It may have been removed. Go back and choose another basket."
            />
          </View>
        )}
      </ScrollView>
      {dtf ? footer : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { paddingHorizontal: space.md },
  back: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingVertical: space.sm,
    paddingHorizontal: space.sm,
  },
  backText: { fontFamily: fonts.regular, fontSize: 15, color: colors.text },
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    marginTop: space.md,
    paddingHorizontal: 18,
    paddingVertical: 18,
    backgroundColor: colors.surface,
    borderRadius: radius.lg,
    borderWidth: 1,
    borderColor: colors.line,
    overflow: 'hidden',
  },
  stripes: {
    position: 'absolute',
    top: 0,
    right: 0,
    width: '62%',
    height: 84,
  },
  cardText: { flex: 1, gap: 4 },
  name: { fontFamily: fonts.medium, fontSize: 19, color: colors.text },
  meta: { fontFamily: fonts.regular, fontSize: 12, color: colors.muted },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.xl,
    marginBottom: space.lg,
    paddingHorizontal: space.lg,
  },
  titleLeft: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  title: { fontFamily: fonts.regular, fontSize: 15, color: colors.gold },
});
