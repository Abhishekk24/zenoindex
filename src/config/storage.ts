/**
 * AppKit's persistence, on AsyncStorage. Every key is prefixed so AppKit only
 * ever sees its own entries: other libraries' values in AsyncStorage (often not
 * JSON) must never reach AppKit's parser, or its session restore fails.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-react-native';

const PREFIX = '@zeno/appkit:';

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

export const appKitStorage: Storage = {
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
      .map(([key, value]) => [fromStorageKey(key), decode<T>(value!)]);
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
