/**
 * Web pages open in the in-app browser (expo-web-browser), never in a jump out
 * to Safari/Chrome or a home-made WebView: SFSafariViewController on iOS —
 * Apple's standard way to show web content inside an app, with Safari's own
 * address bar and Done button — and a Custom Tab on Android.
 */
import * as WebBrowser from 'expo-web-browser';

import { colors } from '../theme/tokens';

const OPTIONS: WebBrowser.WebBrowserOpenOptions = {
  // iOS: Safari's standard full-screen sheet; only the tint is ours.
  presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
  dismissButtonStyle: 'done',
  controlsColor: colors.gold,
  readerMode: false,
  // Android: keep the tab inside the app's task so the app stays in the
  // foreground (wallet requests travel over a live relay connection).
  createTask: false,
  showTitle: true,
  toolbarColor: colors.bg,
};

/**
 * Opens `url` in the in-app browser. iOS resolves when the user closes it
 * (`cancel`) or it is closed by `closeInAppBrowser` (`dismiss`); Android
 * resolves straight away (`opened`).
 */
export function openInAppBrowser(
  url: string,
): Promise<WebBrowser.WebBrowserResult> {
  return WebBrowser.openBrowserAsync(url, OPTIONS);
}

/** Closes the in-app browser if it is open (iOS only; a no-op elsewhere). */
export async function closeInAppBrowser(): Promise<void> {
  try {
    await WebBrowser.dismissBrowser();
  } catch {
    // Nothing open, or the platform can't dismiss it.
  }
}

export function isWebUrl(url: string): boolean {
  return /^https?:\/\//i.test(url);
}
