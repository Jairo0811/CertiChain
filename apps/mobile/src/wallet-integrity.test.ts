import { describe, expect, it } from "vitest";
import { clearWallet, itemKey, loadWallet, saveWallet, SECURE_STORE_VALUE_LIMIT, WALLET_INDEX_KEY, type KeyValueStore } from "./lib/secureWallet";
import { checkRows, outcomeOf, snapshotFromVerification } from "./lib/snapshot";
import { WALLET_KEY, WALLET_LIMIT, upsertWalletCredential } from "./lib/wallet";
import type { Certificate, Verification, WalletCredential } from "./types";

function memoryStore(): KeyValueStore & { data: Map<string, string> } {
  const data = new Map<string, string>();
  return {
    data,
    async getItemAsync(key) {
      return data.get(key) ?? null;
    },
    async setItemAsync(key, value) {
      if (!/^[A-Za-z0-9._-]+$/.test(key)) throw new Error(`Invalid SecureStore key: ${key}`);
      data.set(key, value);
    },
    async deleteItemAsync(key) {
      data.delete(key);
    },
  };
}

function cert(index: number, overrides: Partial<Certificate> = {}): Certificate {
  return {
    id: `00000000-0000-4000-8000-${String(index).padStart(12, "0")}`,
    blockchainId: index % 2 ? `0x${index.toString(16).padStart(64, "0")}` : undefined,
    studentName: "M**** J*** P****",
    title: "Fundamentos de Seguridad de Software ".repeat(3).trim(),
    institution: "Universidad APEC (UNAPEC)",
    issuedAt: "2026-09-01",
    status: "active",
    ...overrides,
  };
}

const idOnly: Verification = {
  valid: true,
  outcome: "valid",
  evidenceMode: "off-chain",
  certificate: cert(1),
  checks: {
    existsOffChain: true,
    hashMatches: null,
    blockchain: null,
    registryStatus: "active",
    integrity: "not_evaluated",
    hashSource: "none",
    blockchainStatus: "not_anchored",
  },
};

describe("verification snapshots", () => {
  it("never reports document integrity for an identifier-only verification", () => {
    const snapshot = snapshotFromVerification(idOnly, "2026-11-05T10:00:00Z", "none")!;
    const rows = checkRows(snapshot);
    expect(rows[1]).toMatchObject({ label: "Integridad del documento", tone: "skip" });
    expect(rows.some((row) => row.value === "Coincide")).toBe(false);
  });

  it("labels a legacy link hash as a link check, not a document check", () => {
    const legacy: Verification = { ...idOnly, checks: { ...idOnly.checks!, integrity: "match", hashSource: "verifier", hashMatches: true } };
    const rows = checkRows(snapshotFromVerification(legacy, "2026-11-05T10:00:00Z", "link")!);
    expect(rows[1]).toMatchObject({ label: "SHA-256 del enlace", tone: "warn" });
  });

  it("derives outcomes from older API responses without the outcome field", () => {
    expect(outcomeOf({ valid: false, certificate: cert(1, { status: "revoked" }) })).toBe("revoked");
    expect(outcomeOf({ valid: false, certificate: cert(1), checks: { existsOffChain: true, hashMatches: false, blockchain: null } })).toBe(
      "integrity_mismatch",
    );
  });

  it("stores the real verification result instead of reconstructing it later", () => {
    const snapshot = snapshotFromVerification({ ...idOnly, outcome: "blockchain_unavailable", valid: false }, "2026-11-05T10:00:00Z", "none");
    const wallet = upsertWalletCredential([], cert(1), `0x${"a".repeat(64)}`, "2026-11-05T10:00:00Z", snapshot);
    expect(wallet[0]?.lastVerification).toMatchObject({ outcome: "blockchain_unavailable", valid: false, integrity: "not_evaluated" });
  });
});

describe("secure wallet storage", () => {
  it("keeps every SecureStore value under the platform size limit at full capacity", async () => {
    const store = memoryStore();
    let wallet: WalletCredential[] = [];
    for (let index = 0; index < WALLET_LIMIT + 5; index += 1) {
      const snapshot = snapshotFromVerification({ ...idOnly, certificate: cert(index) }, new Date(Date.UTC(2026, 0, index + 1)).toISOString(), "none");
      const next = upsertWalletCredential(wallet, cert(index), `0x${"b".repeat(64)}`, new Date(Date.UTC(2026, 0, index + 1)).toISOString(), snapshot);
      await saveWallet(store, next, wallet);
      wallet = next;
    }
    expect(wallet).toHaveLength(WALLET_LIMIT);
    for (const value of store.data.values()) {
      expect(new TextEncoder().encode(value).length).toBeLessThanOrEqual(SECURE_STORE_VALUE_LIMIT);
    }
    // Index + one key per credential; evicted credentials are removed.
    expect(store.data.size).toBe(WALLET_LIMIT + 1);
    expect(await loadWallet(store)).toHaveLength(WALLET_LIMIT);
  });

  it("migrates the v1 single-value wallet and removes the legacy key", async () => {
    const store = memoryStore();
    const legacy = [1, 2, 3].map((index) => ({ ...cert(index), documentHash: `0x${"c".repeat(64)}`, savedAt: "2026-09-01T00:00:00Z", verifiedAt: "2026-09-02T00:00:00Z" }));
    store.data.set(WALLET_KEY, JSON.stringify(legacy));
    const loaded = await loadWallet(store);
    expect(loaded).toHaveLength(3);
    expect(store.data.has(WALLET_KEY)).toBe(false);
    expect(store.data.has(WALLET_INDEX_KEY)).toBe(true);
    expect(await loadWallet(store)).toHaveLength(3);
  });

  it("produces valid, distinct SecureStore keys for any identifier", () => {
    expect(itemKey("DEMO-0001")).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(itemKey("id with spaces/and:colons")).toMatch(/^[A-Za-z0-9._-]+$/);
    expect(itemKey("a/b")).not.toBe(itemKey("a:b"));
  });

  it("clears every stored entry", async () => {
    const store = memoryStore();
    const wallet = upsertWalletCredential([], cert(1), `0x${"d".repeat(64)}`, "2026-11-05T10:00:00Z");
    await saveWallet(store, wallet, []);
    await clearWallet(store, wallet);
    expect(store.data.size).toBe(0);
  });
});
