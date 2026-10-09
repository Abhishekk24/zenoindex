import React from 'react';
import { RefreshControl, ScrollView, StyleSheet } from 'react-native';
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

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.bg },
  content: {
    padding: space.lg,
    gap: space.lg,
    paddingBottom: space.xxl * 2,
  },
});
