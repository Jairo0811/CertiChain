import type { Certificate, DashboardSummary, Session, Verification } from "../types";
export declare function jsonResponse(body: unknown, status?: number): Response;
type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;
/** Routes fetch calls by "METHOD /path" and records every request for assertions. */
export declare function mockApi(routes: Record<string, Handler | unknown>): {
  calls: {
    method: string;
    url: URL;
    body?: unknown;
  }[];
  fetchMock: import("vitest").Mock<(input: RequestInfo | URL, init?: RequestInit) => Promise<Response>>;
};
export declare function session(overrides?: Partial<Session>): Session;
export declare function signIn(value?: Session): void;
export declare function certificate(overrides?: Partial<Certificate>): Certificate;
export declare function dashboard(overrides?: Partial<DashboardSummary>): DashboardSummary;
export declare function verification(overrides?: Partial<Verification>, checks?: Partial<Verification["checks"]>): Verification;
export {};
