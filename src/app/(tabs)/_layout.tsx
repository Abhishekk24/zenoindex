import { Tabs } from 'expo-router/js-tabs';
import React from 'react';
import { StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  ExploreIcon,
  PortfolioIcon,
  ProfileIcon,
} from '../../components/icons';
import { TabBarBackground } from '../../components/navigation/TabBarBackground';
import { colors, fonts, tabBarHeight } from '../../theme/tokens';

export default function TabsLayout() {
  const insets = useSafeAreaInsets();
  return (
    <Tabs
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
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{
          title: 'Portfolio',
          headerShown: false,
          tabBarIcon: PortfolioIcon,
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
