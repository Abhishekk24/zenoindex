/**
 * Landing route for wallets deep-linking back (zeno://wc-return) after the
 * user approves a connection or signature. It renders nothing and returns to
 * the screen that opened the wallet; on a cold start there is nothing to go
 * back to, so it goes to the app's entry instead.
 */
import { router } from 'expo-router';
import { useEffect } from 'react';

export default function WalletReturn() {
  useEffect(() => {
    if (router.canGoBack()) router.back();
    else router.replace('/');
  }, []);
  return null;
}
