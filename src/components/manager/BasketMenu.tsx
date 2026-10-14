/**
 * A basket's ⋮ menu in manager mode (design: Baskets card menu): Rebalance,
 * Corporate actions, Fees, Liquidity and Open details.
 */
import { router, type Href } from 'expo-router';
import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, fonts, space } from '../../theme/tokens';
import {
  ArrowCircleIcon,
  CoinsIcon,
  DocumentStackIcon,
  DropletIcon,
  MoreIcon,
  RebalanceIcon,
} from '../icons';
import type { IconProps } from '../icons';
import { Popover } from '../ui/Popover';

type Item = {
  label: string;
  Icon: (props: IconProps) => React.ReactNode;
  href: (id: string) => Href;
  primary?: boolean;
};

const ITEMS: Item[] = [
  {
    label: 'Rebalance',
    Icon: RebalanceIcon,
    href: id => ({ pathname: '/manager/[id]/rebalance', params: { id } }),
  },
  {
    label: 'Corporate actions',
    Icon: DocumentStackIcon,
    href: id => ({
      pathname: '/manager/[id]/corporate-actions',
      params: { id },
    }),
  },
  {
    label: 'Fees',
    Icon: CoinsIcon,
    href: id => ({ pathname: '/manager/[id]/fees', params: { id } }),
  },
  {
    label: 'Liquidity',
    Icon: DropletIcon,
    href: id => ({ pathname: '/manager/[id]/liquidity', params: { id } }),
  },
  {
    label: 'Open details',
    Icon: ArrowCircleIcon,
    href: id => ({ pathname: '/basket/[id]', params: { id } }),
    primary: true,
  },
];

export function BasketMenu({ id, name }: { id: string; name: string }) {
  return (
    <Popover
      accessibilityLabel={`More actions for ${name}`}
      trigger={
        <View style={styles.button}>
          <MoreIcon color={colors.text} size={18} />
        </View>
      }
    >
      {close => (
        <View accessibilityRole="menu">
          {ITEMS.map(({ label, Icon, href, primary }) => (
            <Pressable
              key={label}
              accessibilityRole="menuitem"
              onPress={() => {
                close();
                router.push(href(id));
              }}
              style={({ pressed }) => [styles.item, pressed && styles.pressed]}
            >
              <Icon color={primary ? colors.green : colors.muted} />
              <Text style={[styles.label, primary && styles.primary]}>
                {label}
              </Text>
            </Pressable>
          ))}
        </View>
      )}
    </Popover>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(5, 7, 6, 0.6)',
  },
  item: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.lg,
    paddingVertical: 11,
  },
  pressed: { backgroundColor: colors.surface2 },
  label: {
    fontFamily: fonts.regular,
    fontSize: 14,
    color: colors.textSecondary,
  },
  primary: { color: colors.green },
});
