/**
 * The app's screen flow. The session's onboarding stage decides which group
 * is mounted:
 *
 *   signedOut → SignIn (email, then the 6-digit code)
 *   terms     → Terms
 *   profile   → CompleteProfile
 *   ready     → Tabs (Explore · Portfolio · Profile), with Basket on top
 */
import {
  DarkTheme,
  NavigationContainer,
  Theme,
} from '@react-navigation/native';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import React from 'react';

import { ExploreIcon, PortfolioIcon, ProfileIcon } from '../components/icons';
import { useSession } from '../lib/session';
import { BasketDetailScreen } from '../screens/BasketDetailScreen';
import { ExploreScreen } from '../screens/ExploreScreen';
import { PortfolioScreen } from '../screens/PortfolioScreen';
import { ProfileScreen } from '../screens/ProfileScreen';
import { CompleteProfileScreen } from '../screens/auth/CompleteProfileScreen';
import { SignInScreen } from '../screens/auth/SignInScreen';
import { TermsScreen } from '../screens/auth/TermsScreen';
import { colors, fonts } from '../theme/tokens';
import type { RootStackParamList, TabParamList } from './types';

const Stack = createNativeStackNavigator<RootStackParamList>();
const Tab = createBottomTabNavigator<TabParamList>();

const theme: Theme = {
  ...DarkTheme,
  colors: {
    ...DarkTheme.colors,
    primary: colors.gold,
    background: colors.bg,
    card: colors.surface,
    text: colors.text,
    border: colors.line,
    notification: colors.gold,
  },
  // Headers use `bold`, tab labels `medium`. The weight is in the family, so
  // fontWeight stays normal (see fonts in theme/tokens.ts).
  fonts: {
    regular: { fontFamily: fonts.regular, fontWeight: 'normal' },
    medium: { fontFamily: fonts.medium, fontWeight: 'normal' },
    bold: { fontFamily: fonts.semibold, fontWeight: 'normal' },
    heavy: { fontFamily: fonts.bold, fontWeight: 'normal' },
  },
};

function Tabs() {
  return (
    <Tab.Navigator
      screenOptions={{
        headerStyle: { backgroundColor: colors.bg },
        headerShadowVisible: false,
        headerTitleStyle: {
          fontFamily: fonts.serif,
          fontSize: 22,
        },
        headerTitleAlign: 'left',
        tabBarActiveTintColor: colors.gold,
        tabBarInactiveTintColor: colors.dim,
        tabBarStyle: {
          backgroundColor: colors.surface,
          borderTopColor: colors.line,
        },
      }}
    >
      <Tab.Screen
        name="Explore"
        component={ExploreScreen}
        options={{
          title: 'Explore baskets',
          tabBarLabel: 'Explore',
          tabBarIcon: ExploreIcon,
        }}
      />
      <Tab.Screen
        name="Portfolio"
        component={PortfolioScreen}
        options={{ tabBarIcon: PortfolioIcon }}
      />
      <Tab.Screen
        name="Profile"
        component={ProfileScreen}
        options={{ tabBarIcon: ProfileIcon }}
      />
    </Tab.Navigator>
  );
}

export function RootNavigator() {
  const { stage } = useSession();
  return (
    <NavigationContainer theme={theme}>
      <Stack.Navigator
        screenOptions={{
          headerStyle: { backgroundColor: colors.bg },
          headerTintColor: colors.gold,
          headerTitleStyle: { color: colors.text },
          headerShadowVisible: false,
          contentStyle: { backgroundColor: colors.bg },
        }}
      >
        {stage === 'signedOut' && (
          <Stack.Screen
            name="SignIn"
            component={SignInScreen}
            options={{ headerShown: false }}
          />
        )}
        {stage === 'terms' && (
          <Stack.Screen
            name="Terms"
            component={TermsScreen}
            options={{ headerShown: false }}
          />
        )}
        {stage === 'profile' && (
          <Stack.Screen
            name="CompleteProfile"
            component={CompleteProfileScreen}
            options={{ headerShown: false }}
          />
        )}
        {stage === 'ready' && (
          <>
            <Stack.Screen
              name="Tabs"
              component={Tabs}
              options={{ headerShown: false }}
            />
            <Stack.Screen
              name="Basket"
              component={BasketDetailScreen}
              options={{ title: '', headerBackTitle: 'Back' }}
            />
          </>
        )}
      </Stack.Navigator>
    </NavigationContainer>
  );
}
