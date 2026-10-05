import { Tabs } from 'expo-router/js-tabs';
import React from 'react';

import {
  ExploreIcon,
  PortfolioIcon,
  ProfileIcon,
} from '../../components/icons';
import { colors, fonts } from '../../theme/tokens';

export default function TabsLayout() {
  return (
    <Tabs
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: { fontFamily: fonts.serif, fontSize: 22 },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tabs.Screen
        name="index"
        options={{
          title: 'Explore baskets',
          tabBarLabel: 'Explore',
          tabBarIcon: ExploreIcon,
        }}
      />
      <Tabs.Screen
        name="portfolio"
        options={{ title: 'Portfolio', tabBarIcon: PortfolioIcon }}
      />
      <Tabs.Screen
        name="profile"
        options={{ title: 'Profile', tabBarIcon: ProfileIcon }}
      />
    </Tabs>
  );
}
