/**
 * The Create tab only opens the full-screen create flow (/manager/create);
 * the tab bar intercepts the press (src/app/(tabs)/_layout.tsx). Landing here
 * directly (e.g. a deep link) forwards there too.
 */
import { Redirect } from 'expo-router';
import React from 'react';

export default function CreateTab() {
  return <Redirect href="/manager/create" />;
}
