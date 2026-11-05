import { API_URL, ApiError, request } from "../lib/api";
import type {
  Certificate,
  CertificateDetail,
  CertificatePage,
  CertificateQuery,
  CertificateStatus,
  DashboardRange,
  DashboardSummary,
  Health,
  Session,
  Verification,
} from "../types";

export const authService = {
  login: (email: string, password: string) =>
    request<Session>("/api/auth/login", { method: "POST", body: { email, password }, auth: false }),
};

export const systemService = {
  health: () => request<Health>("/health", { auth: false, timeoutMs: 5_000 }),
};

export const dashboardService = {
  get: (range: DashboardRange, signal?: AbortSignal) => request<DashboardSummary>(`/api/dashboard?range=${range}`, { signal }),
};

export interface IssuePayload {
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  studentWallet?: string;
}

export const certificateService = {
  list(query: CertificateQuery, signal?: AbortSignal) {
    const params = new URLSearchParams({
      page: String(query.page),
      pageSize: String(query.pageSize),
      sort: query.sort,
      direction: query.direction,
    });
    if (query.search?.trim()) params.set("search", query.search.trim());
    if (query.status) params.set("status", query.status);
    return request<CertificatePage>(`/api/certificates?${params}`, { signal });
  },
  get: (id: string) => request<CertificateDetail>(`/api/certificates/${encodeURIComponent(id)}`),
  // Blockchain confirmation can take a while; give issuance a longer timeout.
  issue: (payload: IssuePayload) =>
    request<Certificate>("/api/certificates", { method: "POST", body: payload, timeoutMs: 120_000 }),
  anchor: (id: string) =>
    request<Certificate>(`/api/certificates/${encodeURIComponent(id)}/anchor`, { method: "POST", timeoutMs: 120_000 }),
  revoke: (id: string, reason?: string) =>
    request<Certificate>(`/api/certificates/${encodeURIComponent(id)}/revoke`, {
      method: "POST",
      body: reason ? { reason } : {},
      timeoutMs: 120_000,
    }),
  changeStatus: (id: string, status: CertificateStatus, reason?: string) =>
    request<Certificate>(`/api/certificates/${encodeURIComponent(id)}/status`, {
      method: "POST",
      body: reason ? { status, reason } : { status },
    }),
  remove: (id: string) =>
    request<{ deleted: true; id: string; evidenceDeleted: boolean }>(`/api/certificates/${encodeURIComponent(id)}`, {
      method: "DELETE",
    }),
  ensurePdf: (id: string) => request<Certificate>(`/api/certificates/${encodeURIComponent(id)}/pdf`, { method: "POST" }),
  async downloadPdf(id: string): Promise<Blob> {
    const response = await request<Response>(`/api/certificates/${encodeURIComponent(id)}/pdf`, { raw: true, timeoutMs: 60_000 });
    return response.blob();
  },
};

export const verificationService = {
  /** Registry + blockchain status by identifier. Makes no claim about any document. */
  byId: (id: string, signal?: AbortSignal) =>
    request<Verification>(`/api/verify/${encodeURIComponent(id)}`, { auth: false, signal }),
  /** Compares a SHA-256 computed locally from the verifier's own PDF. */
  withDocumentHash: (id: string, hash: string, signal?: AbortSignal) =>
    request<Verification>(`/api/verify/${encodeURIComponent(id)}?hash=${encodeURIComponent(hash)}`, { auth: false, signal }),
};

export function isNotFound(error: unknown): boolean {
  return error instanceof ApiError && error.code === "not_found";
}

export { API_URL };
