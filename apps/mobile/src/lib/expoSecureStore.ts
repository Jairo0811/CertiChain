import * as SecureStore from "expo-secure-store";
import type { KeyValueStore } from "./secureWallet";

/** Expo SecureStore behind the KeyValueStore interface used (and tested) by lib/secureWallet. */
export const expoSecureStore: KeyValueStore = {
  getItemAsync: (key) => SecureStore.getItemAsync(key),
  setItemAsync: (key, value) => SecureStore.setItemAsync(key, value),
  deleteItemAsync: (key) => SecureStore.deleteItemAsync(key),
};
