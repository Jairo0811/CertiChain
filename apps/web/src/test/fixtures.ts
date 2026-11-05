import { vi } from "vitest";
import type { Certificate, DashboardSummary, Session, Verification } from "../types";

export function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
}

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path" and records every request for assertions. */
export function mockApi(routes: Record<string, Handler | unknown>) {
  const calls: Array<{ method: string; url: URL; body?: unknown }> = [];
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const method = (init.method ?? "GET").toUpperCase();
    calls.push({ method, url, body: init.body ? JSON.parse(String(init.body)) : undefined });
    const key = Object.keys(routes).find((pattern) => {
      const [routeMethod, routePath] = pattern.split(" ");
      if (routeMethod !== method) return false;
      const regex = new RegExp(`^${routePath!.replace(/:[a-z]+/gi, "[^/]+")}$`);
      return regex.test(url.pathname);
    });
    if (!key) return jsonResponse({ error: "not mocked", code: "not_found" }, 404);
    const handler = routes[key];
    return typeof handler === "function" ? (handler as Handler)(url, init) : jsonResponse(handler);
  });
  vi.stubGlobal("fetch", fetchMock);
  return { calls, fetchMock };
}

export function session(overrides: Partial<Session> = {}): Session {
  return {
    token: "test-token",
    expiresAt: new Date(Date.now() + 3_600_000).toISOString(),
    user: { id: "local-admin", email: "admin@certichain.local", role: "admin" },
    ...overrides,
  };
}

export function signIn(value: Session = session()) {
  sessionStorage.setItem("certichain-session", JSON.stringify(value));
}

let counter = 0;
export function certificate(overrides: Partial<Certificate> = {}): Certificate {
  counter += 1;
  return {
    id: `00000000-0000-4000-8000-${String(counter).padStart(12, "0")}`,
    studentName: `Estudiante ${counter}`,
    studentWallet: `0x${"1".repeat(40)}`,
    title: `Título ${counter}`,
    institution: "UNAPEC",
    issuedAt: "2026-09-01",
    documentHash: `0x${"a".repeat(64)}`,
    metadataURI: "local-encrypted://file.enc",
    documentAvailable: true,
    status: "active",
    issuerEmail: "admin@certichain.local",
    createdAt: "2026-09-01T12:00:00.000Z",
    evidenceMode: "off-chain",
    statusManagedByBlockchain: false,
    chainSyncStatus: "not_requested",
    ...overrides,
  };
}

export function dashboard(overrides: Partial<DashboardSummary> = {}): DashboardSummary {
  return {
    range: { key: "90", from: "2026-08-08", to: "2026-11-05", dateBasis: "issuedAt", granularity: "week" },
    period: { issued: 12, active: 9, pending: 2, revoked: 1, institutions: 3, revocationsInRange: 1, onChain: 0 },
    allTime: { total: 30, active: 25, pending: 3, revoked: 2, institutions: 4 },
    trend: null,
    series: [
      { key: "a", label: "01 sept", start: "2026-09-01", issued: 5 },
      { key: "b", label: "08 sept", start: "2026-09-08", issued: 7 },
    ],
    byInstitution: [{ institution: "UNAPEC", issued: 12 }],
    activity: [
      {
        id: "evt-1",
        action: "certificate.revoke",
        actor: "admin@certichain.local",
        timestamp: "2026-11-01T10:00:00.000Z",
        certificateId: "cert-1",
        title: "Ingeniería de Software",
        studentName: "Ana Pérez",
      },
    ],
    ...overrides,
  };
}

export function verification(overrides: Partial<Verification> = {}, checks: Partial<Verification["checks"]> = {}): Verification {
  return {
    valid: true,
    outcome: "valid",
    evidenceMode: "off-chain",
    verifiedAt: "2026-11-05T10:00:00.000Z",
    certificate: {
      id: "cert-1",
      studentName: "A** P****",
      title: "Ingeniería de Software",
      institution: "UNAPEC",
      issuedAt: "2026-09-01",
      status: "active",
      evidenceMode: "off-chain",
    },
    checks: {
      existsOffChain: true,
      registryStatus: "active",
      integrity: "not_evaluated",
      hashSource: "none",
      hashMatches: null,
      blockchainStatus: "not_anchored",
      statusManagedByBlockchain: false,
      ...checks,
    },
    ...overrides,
  };
}
