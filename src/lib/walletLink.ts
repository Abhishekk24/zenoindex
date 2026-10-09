/**
 * Brings the connected wallet app to the front so the user sees a pending
 * request (signature or transaction).
 *
 * AppKit opens the wallet when connecting, but not for later requests: those
 * travel over the WalletConnect relay and wait silently in the wallet unless
 * the user switches to it. AppKit saves the connected wallet's link (e.g.
 * `metamask://`) under this key in its storage; we open it right after
 * sending a request.
 */
import { Linking } from 'react-native';

import { appKitStorage } from '../config/storage';

/** AppKit's storage key for the connected wallet's link (SafeStorageKeys.WC_DEEPLINK). */
const WC_DEEPLINK = 'WALLETCONNECT_DEEPLINK_CHOICE';

export async function openConnectedWallet(): Promise<void> {
  try {
    const link = await appKitStorage.getItem<{ href?: string }>(WC_DEEPLINK);
    if (link?.href) await Linking.openURL(link.href);
  } catch {
    // No saved link, or the wallet can't be opened: the request still waits
    // in the wallet, the user just has to switch to it themselves.
  }
}

/**
 * Sends a wallet request and opens the wallet so the user can approve it.
 * The request goes first, so it is already waiting when the wallet opens.
 */
export async function withWalletOpen<T>(request: () => Promise<T>): Promise<T> {
  const pending = request();
  await openConnectedWallet();
  return pending;
}
