/**
 * Top of the main screens: gold wordmark, the screen title, and the Explore
 * actions (strategy filter, manager filter, search).
 *
 * Off Explore, the filter buttons go to Explore with that filter open.
 */
import { router } from 'expo-router';
import React from 'react';
import {
  Image,
  Platform,
  StatusBar,
  StyleSheet,
  Text,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, fonts, space } from '../theme/tokens';
import { ManagerIcon, SearchIcon, StrategyIcon } from './icons';
import { IconButton } from './ui';

export type ExplorePanel = 'strategy' | 'manager';

/** Opens Explore with a filter panel showing (`at` makes repeat taps reopen it). */
export function openExploreFilter(panel: ExplorePanel) {
  router.navigate({ pathname: '/', params: { panel, at: String(Date.now()) } });
}

export function AppHeader({
  title,
  actions = true,
  filters = true,
  strategyActive,
  managerActive,
  onStrategy,
  onManager,
}: {
  title: string;
  /** Show the three round action buttons. */
  actions?: boolean;
  /** Include the strategy and manager filter buttons (search always shows). */
  filters?: boolean;
  strategyActive?: boolean;
  managerActive?: boolean;
  onStrategy?: () => void;
  onManager?: () => void;
}) {
  const insets = useSafeAreaInsets();
  // Clear the status bar even if the safe-area inset reports 0 (seen on some
  // Android devices with edge-to-edge): fall back to Android's own height.
  const statusBar = Math.max(
    insets.top,
    Platform.OS === 'android' ? (StatusBar.currentHeight ?? 0) : 0,
  );
  return (
    <View style={[styles.header, { paddingTop: statusBar + space.xl }]}>
      <Image
        source={require('../../assets/images/zeno-gold.png')}
        style={styles.logo}
        accessibilityLabel="Zeno"
      />
      <View style={styles.titleRow}>
        <Text style={styles.title}>{title}</Text>
        {actions && (
          <View style={styles.actions}>
            {filters && (
              <>
                <IconButton
                  icon={
                    <StrategyIcon
                      color={strategyActive ? colors.gold : colors.text}
                    />
                  }
                  onPress={onStrategy ?? (() => openExploreFilter('strategy'))}
                  active={strategyActive}
                  accessibilityLabel="Filter by strategy"
                />
                <IconButton
                  icon={
                    <ManagerIcon
                      color={managerActive ? colors.gold : colors.text}
                    />
                  }
                  onPress={onManager ?? (() => openExploreFilter('manager'))}
                  active={managerActive}
                  accessibilityLabel="Filter by manager"
                />
              </>
            )}
            <IconButton
              icon={<SearchIcon color={colors.text} />}
              onPress={() => router.push({ pathname: '/search' })}
              filled
              accessibilityLabel="Search baskets"
            />
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  header: { paddingHorizontal: space.lg },
  logo: { width: 50, height: 13 },
  titleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginTop: space.lg,
    minHeight: 40,
  },
  title: { fontFamily: fonts.medium, fontSize: 21, color: colors.text },
  actions: { flexDirection: 'row', gap: space.sm },
});
