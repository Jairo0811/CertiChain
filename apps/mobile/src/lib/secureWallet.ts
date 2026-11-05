import type { WalletCredential } from "../types";
import { credentialId, normalizeWallet, WALLET_KEY, WALLET_LIMIT } from "./wallet";

/**
 * Expo SecureStore warns that values above ~2048 bytes may fail on some platforms (and keychain
 * entries are not meant for large blobs). The v1 layout stored the whole wallet as one JSON value,
 * which exceeds that limit after a few credentials. The v2 layout stores one credential per key
 * plus a small index, keeping each value well below the limit.
 */
export const WALLET_INDEX_KEY = "certichain-wallet-v2-index";
export const WALLET_ITEM_PREFIX = "certichain-wallet-v2-item-";
export const SECURE_STORE_VALUE_LIMIT = 2048;

export interface KeyValueStore {
  getItemAsync(key: string): Promise<string | null>;
  setItemAsync(key: string, value: string): Promise<void>;
  deleteItemAsync(key: string): Promise<void>;
}

/** SecureStore keys allow only [A-Za-z0-9._-]; derive a short stable key from any credential id. */
export function itemKey(id: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < id.length; index += 1) {
    hash ^= id.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  const safe = id.replace(/[^A-Za-z0-9._-]/g, "").slice(0, 24);
  return `${WALLET_ITEM_PREFIX}${safe}-${hash.toString(16)}`;
}

function byteLength(value: string): number {
  return new TextEncoder().encode(value).length;
}

/** Drops optional fields if a single credential would still exceed the per-value limit. */
function compact(credential: WalletCredential): string {
  let serialized = JSON.stringify(credential);
  if (byteLength(serialized) <= SECURE_STORE_VALUE_LIMIT) return serialized;
  const { lastVerification: _dropped, ...rest } = credential;
  serialized = JSON.stringify({ ...rest, studentName: rest.studentName.slice(0, 120), title: rest.title.slice(0, 200) });
  return serialized;
}

export async function loadWallet(store: KeyValueStore): Promise<WalletCredential[]> {
  const index = await store.getItemAsync(WALLET_INDEX_KEY);
  if (index) {
    let keys: string[] = [];
    try {
      keys = JSON.parse(index) as string[];
    } catch {
      keys = [];
    }
    const items = await Promise.all(keys.map((key) => store.getItemAsync(key)));
    const parsed = items.flatMap((item) => {
      if (!item) return [];
      try {
        return [JSON.parse(item) as unknown];
      } catch {
        return [];
      }
    });
    return normalizeWallet(parsed);
  }

  // One-time migration from the v1 single-value layout.
  const legacy = await store.getItemAsync(WALLET_KEY);
  if (!legacy) return [];
  let wallet: WalletCredential[] = [];
  try {
    wallet = normalizeWallet(JSON.parse(legacy) as unknown);
  } catch {
    wallet = [];
  }
  await saveWallet(store, wallet, []);
  await store.deleteItemAsync(WALLET_KEY);
  return wallet;
}

/** Writes items first, then the index, then removes orphaned items: a crash never loses the index. */
export async function saveWallet(store: KeyValueStore, next: WalletCredential[], previous: WalletCredential[]): Promise<void> {
  const limited = next.slice(0, WALLET_LIMIT);
  const keys = limited.map((credential) => itemKey(credentialId(credential)));
  for (const [position, credential] of limited.entries()) {
    await store.setItemAsync(keys[position]!, compact(credential));
  }
  await store.setItemAsync(WALLET_INDEX_KEY, JSON.stringify(keys));
  const keep = new Set(keys);
  for (const credential of previous) {
    const key = itemKey(credentialId(credential));
    if (!keep.has(key)) await store.deleteItemAsync(key);
  }
}

export async function clearWallet(store: KeyValueStore, current: WalletCredential[]): Promise<void> {
  let indexed: string[] = [];
  try {
    indexed = JSON.parse((await store.getItemAsync(WALLET_INDEX_KEY)) ?? "[]") as string[];
  } catch {
    indexed = [];
  }
  const keys = new Set([...indexed, ...current.map((credential) => itemKey(credentialId(credential)))]);
  for (const key of keys) await store.deleteItemAsync(key);
  await store.deleteItemAsync(WALLET_INDEX_KEY);
  await store.deleteItemAsync(WALLET_KEY);
}
