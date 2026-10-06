import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Storage } from '@reown/appkit-common-react-native';

export const appKitStorage: Storage = {
  async getKeys() {
    const keys = await AsyncStorage.getAllKeys();
    return [...keys];
  },

  async getEntries<T = any>() {
    const keys = await AsyncStorage.getAllKeys();
    const entries = await AsyncStorage.multiGet(keys);

    return entries
      .filter(([, value]) => value !== null)
      .map(([key, value]) => [key, JSON.parse(value!) as T]);
  },

  async getItem<T = any>(key: string) {
    const value = await AsyncStorage.getItem(key);

    if (value === null) {
      return undefined;
    }

    return JSON.parse(value) as T;
  },

  async setItem<T = any>(key: string, value: T) {
    await AsyncStorage.setItem(key, JSON.stringify(value));
  },

  async removeItem(key: string) {
    await AsyncStorage.removeItem(key);
  },
};
