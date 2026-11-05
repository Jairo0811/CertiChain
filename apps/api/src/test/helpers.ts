import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import request from "supertest";
import { expect } from "vitest";
import { createApp, type AppDependencies } from "../app.js";
import type {
  BlockchainVerificationResult,
  CertificateRegistryClient,
  IssueReceiptLookup,
  SubmittedTransaction,
} from "../blockchain.js";
import { JsonStore } from "../store.js";

export const HOLDER_WALLET = "0x8ba1f109551bD432803012645Ac136ddd64DBA72";

export function isolatedStore(): JsonStore {
  const directory = mkdtempSync(join(tmpdir(), "certichain-test-"));
  return new JsonStore(join(directory, "store.json"));
}

export function testApp(dependencies: AppDependencies = {}) {
  const store = dependencies.store ?? isolatedStore();
  const app = createApp({ ...dependencies, store });
  return { app, store };
}

export async function login(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin@certichain.local",
    password: "CertiChain123!",
  });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

export const validIssuePayload = {
  studentName: "Ana Pérez",
  title: "Ingeniería de Software",
  institution: "Universidad APEC (UNAPEC)",
  issuedAt: "2026-09-01",
};

export interface FakeRegistryOptions {
  configured?: boolean;
  submit?: "ok" | "reject" | "confirm-timeout";
  verify?: Partial<BlockchainVerificationResult> | "throw";
  receipt?: IssueReceiptLookup;
  recovered?: string;
}

/** In-memory CertificateRegistryClient used to exercise blockchain failure modes deterministically. */
export function fakeRegistry(options: FakeRegistryOptions = {}) {
  let counter = 0;
  const calls = { submit: 0, revoke: 0, verify: 0, receipt: 0, recovery: 0 };
  const registry: CertificateRegistryClient & { calls: typeof calls; options: FakeRegistryOptions } = {
    configured: options.configured ?? true,
    calls,
    options,
    async submitIssue(): Promise<SubmittedTransaction> {
      calls.submit += 1;
      if (registry.options.submit === "reject") throw new Error("connect ECONNREFUSED 127.0.0.1:8545");
      counter += 1;
      const transactionHash = `0x${counter.toString(16).padStart(64, "a")}`;
      const certificateId = `0x${counter.toString(16).padStart(64, "c")}`;
      const confirmation =
        registry.options.submit === "confirm-timeout"
          ? Promise.reject(new Error("timeout waiting for receipt"))
          : Promise.resolve({ certificateId, transactionHash });
      confirmation.catch(() => undefined);
      return { transactionHash, confirmation };
    },
    async findIssueReceipt() {
      calls.receipt += 1;
      return registry.options.receipt ?? { state: "pending" };
    },
    async findIssuedByEvidence() {
      calls.recovery += 1;
      return registry.options.recovered;
    },
    async revoke() {
      calls.revoke += 1;
      return `0x${"d".repeat(64)}`;
    },
    async verify() {
      calls.verify += 1;
      if (registry.options.verify === "throw") throw new Error("could not detect network");
      return {
        exists: true,
        active: true,
        hashMatches: true,
        issuer: "0x0000000000000000000000000000000000000001",
        student: HOLDER_WALLET,
        issuedAt: 1,
        revokedAt: 0,
        ...(registry.options.verify ?? {}),
      };
    },
  };
  return registry;
}
