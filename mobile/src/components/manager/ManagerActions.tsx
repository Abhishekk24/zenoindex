/**
 * Manager shortcuts on a basket's detail page (manager mode only): the things
 * a manager does with a basket, one tap away instead of behind the ⋮ menu.
 * An unseeded basket first gets a Seed button: the 1 USDG genesis deposit
 * that opens it to investors, signed right here.
 */
import { router, type Href } from 'expo-router';
import React, { useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { useSendDraft } from '../../hooks/useSendDraft';
import * as api from '../../lib/api';
import type { DtfDetail } from '../../lib/types';
import { colors, fonts, space } from '../../theme/tokens';
import {
  CoinsIcon,
  DocumentStackIcon,
  RebalanceIcon,
  StrategyIcon,
} from '../icons';
import type { IconProps } from '../icons';
import { alert, Button } from '../ui';

type Action = {
  label: string;
  Icon: (props: IconProps) => React.ReactNode;
  href: (id: string) => Href;
};

const ACTIONS: Action[] = [
  {
    label: 'Rebalance',
    Icon: RebalanceIcon,
    href: id => ({ pathname: '/manager/[id]/rebalance', params: { id } }),
  },
  {
    label: 'Weights',
    Icon: StrategyIcon,
    href: id => ({ pathname: '/manager/[id]/weights', params: { id } }),
  },
  {
    label: 'Fees',
    Icon: CoinsIcon,
    href: id => ({ pathname: '/manager/[id]/fees', params: { id } }),
  },
  {
    label: 'Corp. actions',
    Icon: DocumentStackIcon,
    href: id => ({
      pathname: '/manager/[id]/corporate-actions',
      params: { id },
    }),
  },
];

export function ManagerActions({
  dtf,
  onSeeded,
}: {
  dtf: DtfDetail;
  /** Re-read the basket after a successful seed. */
  onSeeded: () => void;
}) {
  const sendDraft = useSendDraft();
  const [seeding, setSeeding] = useState(false);
  // Genesis mints the first shares (to the vault itself), so no supply means not seeded yet.
  const unseeded = dtf.totalSupplyRaw === '0';

  const seed = async () => {
    setSeeding(true);
    try {
      await sendDraft(
        await api.prepareManagerTx(dtf, {
          name: 'genesis',
          body: { baselineSharePrice: '1' },
        }),
      );
      alert('Basket seeded', 'Investors can buy in now.');
      onSeeded();
    } catch (e) {
      alert(
        'Could not seed',
        e instanceof Error ? e.message : 'Transaction failed.',
      );
    } finally {
      setSeeding(false);
    }
  };

  return (
    <View style={styles.wrap}>
      {unseeded ? (
        <View style={styles.seed}>
          <Text style={styles.seedTitle}>Not open to investors yet</Text>
          <Text style={styles.seedBody}>
            Seed it with a 1 USDG genesis deposit from your wallet. That sets
            the starting price at 1 USDG per share and lets people invest.
          </Text>
          <Button
            label={
              seeding ? 'Waiting for confirmation…' : 'Seed the basket (1 USDG)'
            }
            variant="green"
            disabled={seeding}
            onPress={() => void seed()}
          />
        </View>
      ) : null}
      <View style={styles.row}>
        {ACTIONS.map(({ label, Icon, href }) => (
          <Pressable
            key={label}
            onPress={() => router.push(href(dtf.id))}
            accessibilityRole="button"
            style={({ pressed }) => [styles.action, pressed && styles.pressed]}
          >
            <Icon color={colors.gold} size={18} />
            <Text style={styles.label}>{label}</Text>
          </Pressable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md, marginBottom: space.md },
  seed: {
    gap: space.sm,
    padding: space.lg,
    borderWidth: 1,
    borderColor: colors.greenLine,
    borderRadius: 12,
    backgroundColor: colors.greenSoft,
  },
  seedTitle: { fontFamily: fonts.medium, fontSize: 15, color: colors.text },
  seedBody: {
    fontFamily: fonts.regular,
    fontSize: 13,
    lineHeight: 18,
    color: colors.textSecondary,
  },
  row: { flexDirection: 'row', gap: space.sm },
  action: {
    flex: 1,
    alignItems: 'center',
    gap: 6,
    paddingVertical: space.md,
    borderWidth: 1,
    borderColor: colors.line,
    borderRadius: 12,
    backgroundColor: colors.surface2,
  },
  label: { fontFamily: fonts.medium, fontSize: 12, color: colors.text },
  pressed: { opacity: 0.75 },
});
