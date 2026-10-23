/**
 * The wallet apps installed on this phone (Android): every app that opens
 * WalletConnect links, with name, icon and whether it's the default for them.
 * Elsewhere (iOS, which can't list apps; Expo Go, without the native module)
 * it returns nothing and the picker falls back to its known-wallet checks.
 */
import { requireOptionalNativeModule } from 'expo';

export type InstalledWallet = {
  /** Android package, e.g. "io.metamask". */
  packageName: string;
  /** The app's name on this phone. */
  label: string;
  /** Launcher icon as a data: URI. */
  icon: string;
  /** The phone opens WalletConnect links in this app by default. */
  isDefault: boolean;
};

type Native = {
  walletApps(): Promise<InstalledWallet[]>;
  openIn(url: string, packageName: string): Promise<void>;
  launch(packageName: string): Promise<void>;
};

const native = requireOptionalNativeModule<Native>('WalletDetector');

/** True where installed wallets can be listed (Android builds). */
export const canDetectWallets = native !== null;

export async function installedWallets(): Promise<InstalledWallet[]> {
  return native ? native.walletApps().catch(() => []) : [];
}

/** Opens `url` in that app only; false if it couldn't. */
export async function openInWallet(
  url: string,
  packageName: string,
): Promise<boolean> {
  if (!native) return false;
  return native.openIn(url, packageName).then(
    () => true,
    () => false,
  );
}

/** Brings that app to the front; false if it couldn't. */
export async function launchWallet(packageName: string): Promise<boolean> {
  if (!native) return false;
  return native.launch(packageName).then(
    () => true,
    () => false,
  );
}
