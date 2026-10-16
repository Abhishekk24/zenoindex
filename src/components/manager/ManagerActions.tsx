/**
 * Manager shortcuts on a basket's detail page (manager mode only): the things
 * a manager does with a basket, one tap away instead of behind the ⋮ menu.
 */
import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';
import {
  CoinsIcon,
  DocumentStackIcon,
  RebalanceIcon,
  StrategyIcon,
} from '../icons';
import type { IconProps } from '../icons';

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

export function ManagerActions({ id }: { id: string }) {
  return (
    <View style={styles.row}>
      {ACTIONS.map(({ label, Icon, href }) => (
        <Pressable
          key={label}
          onPress={() => router.push(href(id))}
          accessibilityRole="button"
          style={({ pressed }) => [styles.action, pressed && styles.pressed]}
        >
          <Icon color={colors.gold} size={18} />
          <Text style={styles.label}>{label}</Text>
        </Pressable>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm, marginBottom: space.md },
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
