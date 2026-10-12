/**
 * Email / Google sign-in through Reown's embedded wallet, shown in the in-app
 * browser (lib/browser.ts).
 *
 * This is what AppKit's own social login step does, except that AppKit opens
 * the page with Linking (out to Safari): start a WalletConnect pairing, open
 * Reown's web wallet with the pairing link and the provider, and wait for the
 * wallet to connect. The web wallet's link is saved as the connected wallet so
 * later signature requests reopen it (lib/walletLink.ts).
 */
import { ConstantsUtil } from '@reown/appkit-common-react-native';
import { CoreHelperUtil, WcController } from '@reown/appkit-core-react-native';

import { appKit } from '../config/wallet';
import { closeInAppBrowser, openInAppBrowser } from './browser';

export type SocialProvider = 'email' | 'google';

export class SocialLoginCancelled extends Error {
  constructor() {
    super('Sign-in cancelled.');
  }
}

/** Resolves with the pairing link once AppKit has created it. */
function nextPairingUri(): Promise<string> {
  return new Promise(resolve => {
    const unsubscribe = WcController.subscribeKey('wcUri', uri => {
      if (!uri) return;
      unsubscribe();
      resolve(uri);
    });
  });
}

/**
 * Connects Reown's embedded wallet for `provider`. Resolves once connected;
 * rejects with SocialLoginCancelled if the user closes the browser first (iOS).
 */
export async function connectWithSocial(
  provider: SocialProvider,
): Promise<void> {
  WcController.clearUri();
  const pairing = nextPairingUri();
  const connecting = appKit.connect();
  const uri = await Promise.race([pairing, connecting.then(() => null)]);
  if (!uri) return;

  const { redirect, href } = CoreHelperUtil.formatUniversalUrl(
    ConstantsUtil.WEB_WALLET_URL,
    uri,
    provider,
  );
  const linking = { name: 'Reown Wallet', href };
  WcController.setWcLinking(linking);

  const closed = openInAppBrowser(redirect).then(result => {
    if (result.type === 'cancel') throw new SocialLoginCancelled();
  });
  try {
    await Promise.race([connecting, closed.then(() => connecting)]);
  } finally {
    void closeInAppBrowser();
  }
  await WcController.setConnectedWallet(linking);
}
