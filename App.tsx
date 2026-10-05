/**
 * Zeno mobile: investor app for on-chain baskets (DTFs) on Robinhood Chain.
 * Screens run on development sample data (src/lib/data.ts) until the app is
 * connected to the web app's /api/v1.
 */
import React from 'react';
import { StatusBar } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { SessionProvider } from './src/lib/session';
import { RootNavigator } from './src/navigation/RootNavigator';

function App() {
  return (
    <SafeAreaProvider>
      <StatusBar barStyle="light-content" />
      <SessionProvider>
        <RootNavigator />
      </SessionProvider>
    </SafeAreaProvider>
  );
}

export default App;
