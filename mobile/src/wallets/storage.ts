/**
 * WalletConnect's persistence (sessions, keys, pairings), on AsyncStorage.
 * Every key is prefixed so it only ever sees its own entries: other values in
 * AsyncStorage (often not JSON) must never reach its parser.
 *
 * Also removes what the previous wallet setup (Reown AppKit) left behind —
 * its sessions and unacknowledged messages replayed old errors on every launch.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { UniversalProviderOpts } from '@walletconnect/universal-provider';

// WalletConnect's storage interface, taken from the provider's own options so
// it always matches the installed version.
type IKeyValueStorage = NonNullable<UniversalProviderOpts['storage']>;

const PREFIX = '@zeno/wc:';
/** AppKit's prefix, and WalletConnect's own default keys from early builds. */
const LEGACY = ['@zeno/appkit:', 'wc@2:'];

const toStorageKey = (key: string) => `${PREFIX}${key}`;
const fromStorageKey = (key: string) => key.slice(PREFIX.length);

/** JSON when it parses, otherwise the raw string. */
function decode<T>(value: string): T {
  try {
    return JSON.parse(value) as T;
  } catch {
    return value as T;
  }
}

export async function removeLegacyWalletData(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const legacy = keys.filter(key => LEGACY.some(p => key.startsWith(p)));
    if (legacy.length) await AsyncStorage.multiRemove(legacy);
  } catch {
    // Nothing to clean, or storage unavailable: harmless either way.
  }
}

export const walletStorage: IKeyValueStorage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return keys.filter(key => key.startsWith(PREFIX)).map(fromStorageKey);
  },

  async getEntries<T = unknown>() {
    const keys = await AsyncStorage.getAllKeys();
    const ours = keys.filter(key => key.startsWith(PREFIX));
    const entries = await AsyncStorage.multiGet(ours);
    return entries
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [fromStorageKey(key), decode<T>(value!)]) as [
      string,
      T,
    ][];
  },

  async getItem<T = unknown>(key: string) {
    const value = await AsyncStorage.getItem(toStorageKey(key));
    return value === null ? undefined : decode<T>(value);
  },

  async setItem<T = unknown>(key: string, value: T) {
    await AsyncStorage.setItem(toStorageKey(key), JSON.stringify(value));
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(toStorageKey(key));
  },
};
