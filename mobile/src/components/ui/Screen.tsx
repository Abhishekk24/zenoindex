import React from 'react';
import {
  FlatList,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
  type FlatListProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, space, tabBarHeight } from '../../theme/tokens';

type ScreenProps = {
  children: React.ReactNode;
  /** Pull-to-refresh. */
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Pad for the status bar when there is no navigation header above. */
  topInset?: boolean;
  /** Leave room at the bottom for the floating tab bar (tab screens). */
  tabBar?: boolean;
};

/** Scrolling screen body with the standard padding and spacing. */
export function Screen({
  children,
  onRefresh,
  refreshing = false,
  topInset,
  tabBar,
}: ScreenProps) {
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[
        styles.content,
        topInset && { paddingTop: insets.top + space.lg },
        tabBar && {
          paddingBottom: tabBarHeight + insets.bottom + space.xl,
        },
      ]}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        ) : undefined
      }
    >
      {children}
    </ScrollView>
  );
}

/** The gap between a ScreenList's rows (Screen's gap). */
const RowGap = () => <View style={styles.rowGap} />;

/**
 * Screen for a long list: Screen's padding, tab-bar room and pull-to-refresh,
 * but only the rows near the screen are rendered (FlatList), so a long list
 * scrolls and filters without rendering every row.
 */
export function ScreenList<T>({
  onRefresh,
  refreshing = false,
  tabBar,
  ...list
}: Omit<
  FlatListProps<T>,
  'style' | 'contentContainerStyle' | 'refreshControl'
> &
  Pick<ScreenProps, 'onRefresh' | 'refreshing' | 'tabBar'>) {
  const insets = useSafeAreaInsets();
  return (
    <FlatList
      style={styles.screen}
      contentContainerStyle={[
        styles.listContent,
        tabBar && {
          paddingBottom: tabBarHeight + insets.bottom + space.xl,
        },
      ]}
      ItemSeparatorComponent={RowGap}
      keyboardShouldPersistTaps="handled"
      refreshControl={
        onRefresh ? (
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.gold}
          />
        ) : undefined
      }
      {...list}
    />
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl * 2,
  },
  // Rows are spaced by RowGap: a gap would also space FlatList's spacers.
  listContent: { padding: space.lg, paddingBottom: space.xxl * 2 },
  rowGap: { height: space.lg },
});
