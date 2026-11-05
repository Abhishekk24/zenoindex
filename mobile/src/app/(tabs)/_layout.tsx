import { router } from 'expo-router';
import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BasketsIcon,
  CoinsIcon,
  CreateIcon,
  ExploreIcon,
  PortfolioIcon,
  ProfileIcon,
} from '../../components/icons';
import { TabBarBackground } from '../../components/navigation/TabBarBackground';
import { TabBlurTarget } from '../../components/navigation/TabBlur';
import { useAppMode } from '../../lib/appMode';
import { colors, fonts, tabBarHeight } from '../../theme/tokens';

/**
 * Investor mode: Explore · Portfolio · Profile. Manager mode (Profile →
 * Manager Mode): Baskets · Create · Assets · Profile. Hidden tabs keep
 * their routes but get no button (`href: null`).
 */
export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  const { mode } = useAppMode();
  const manager = mode === 'manager';
  return (
    <Tabs
      // Each screen is what the tab bar blurs on Android (TabBlur).
      screenLayout={({ route, navigation, children }) => (
        <TabBlurTarget routeKey={route.key} navigation={navigation}>
          {children}
        </TabBlurTarget>
      )}
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.medium, fontSize: 20 },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.text,
        tabBarInactiveTintColor: colors.dim,
        tabBarLabelStyle: { fontFamily: fonts.medium, fontSize: 12 },
        tabBarStyle: {
          position: 'absolute',
          height: tabBarHeight + insets.bottom,
          paddingTop: 8,
          backgroundColor: 'transparent',
          borderTopWidth: StyleSheet.hairlineWidth,
          borderTopColor: colors.lineStrong,
          elevation: 0,
        },
        tabBarBackground: TabBarBackground,
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore',
          headerShown: false,
          tabBarIcon: ExploreIcon,
          href: manager ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="baskets"
        options={{
          title: 'Baskets',
          headerShown: false,
          tabBarIcon: BasketsIcon,
          href: manager ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="create"
        options={{
          title: 'Create',
          headerShown: false,
          tabBarIcon: CreateIcon,
          href: manager ? undefined : null,
        }}
        listeners={{
          // Create is a full-screen flow with its own back, not a tab page.
          tabPress: e => {
            e.preventDefault();
            router.push('/manager/create');
          },
        }}
      />
      <Tabs.Screen
        name="assets"
        options={{
          title: 'Assets',
          headerShown: false,
          tabBarIcon: CoinsIcon,
          href: manager ? undefined : null,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          headerShown: false,
          tabBarIcon: PortfolioIcon,
          href: manager ? null : undefined,
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Profile',
          headerShown: false,
          tabBarIcon: ProfileIcon,
        }}
      />
    </Tabs>
  );
}
