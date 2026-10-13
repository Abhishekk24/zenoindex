/**
 * Brings the connected wallet to the front so the user sees a pending
 * request (signature or transaction).
 *
 * AppKit opens the wallet when connecting, but not for later requests: those
 * travel over the WalletConnect relay and wait silently in the wallet unless
 * the user switches to it. AppKit saves the connected wallet's link under this
 * key in its storage; we open it right after sending a request. A wallet app's
 * link (e.g. `metamask://`) opens that app; Reown's email/Google wallet is a
 * web page (`https://…`), which opens in the in-app browser (lib/browser.ts).
 */
import { Linking } from 'react-native';

import { appKitStorage } from '../config/storage';
import { appKit } from '../config/wallet';
import { closeInAppBrowser, isWebUrl, openInAppBrowser } from './browser';

/** AppKit's storage key for the connected wallet's link (SafeStorageKeys.WC_DEEPLINK). */
const WC_DEEPLINK = 'WALLETCONNECT_DEEPLINK_CHOICE';

/** Opens the connected wallet; true if it is a web wallet in the in-app browser. */
export async function openConnectedWallet(): Promise<boolean> {
  try {
    const link = await appKitStorage.getItem<{ href?: string }>(WC_DEEPLINK);
    if (!link?.href) return false;
    if (isWebUrl(link.href)) {
      // Not awaited: on iOS this resolves only when the browser closes.
      void openInAppBrowser(link.href);
      return true;
    }
    await Linking.openURL(link.href);
  } catch {
    // No saved link, or the wallet can't be opened: the request still waits
    // in the wallet, the user just has to switch to it themselves.
  }
  return false;
}

/**
 * Sends a wallet request and opens the wallet so the user can approve it.
 * The request goes first, so it is already waiting when the wallet opens. A
 * web wallet's browser closes again once the request is answered.
 */
export async function withWalletOpen<T>(request: () => Promise<T>): Promise<T> {
  try {
    return await sendAndOpen(request);
  } catch (e) {
    if (isStaleSession(e)) {
      // The wallet dropped this session (expired, or disconnected on its side):
      // forget it here too so the app asks for a fresh connection.
      await appKit.disconnect().catch(() => {});
      throw new Error(WALLET_SESSION_EXPIRED);
    }
    throw e;
  }
}

export const WALLET_SESSION_EXPIRED =
  'Your wallet connection expired. Connect your wallet again.';

/** WalletConnect's errors for a session or request the wallet no longer has. */
const STALE_SESSION =
  /recently deleted|No matching key|topic doesn't exist|Request expired/i;

export function isStaleSession(e: unknown): boolean {
  return e instanceof Error && STALE_SESSION.test(e.message);
}

async function sendAndOpen<T>(request: () => Promise<T>): Promise<T> {
  const pending = request();
  const inBrowser = await openConnectedWallet();
  if (!inBrowser) return pending;
  try {
    return await pending;
  } finally {
    void closeInAppBrowser();
  }
}
