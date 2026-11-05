import { API_URL } from "../lib/api";
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
export declare const authService: {
  login: (email: string, password: string) => Promise<Session>;
};
export declare const systemService: {
  health: () => Promise<Health>;
};
export declare const dashboardService: {
  get: (range: DashboardRange, signal?: AbortSignal) => Promise<DashboardSummary>;
};
export interface IssuePayload {
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  studentWallet?: string;
}
export declare const certificateService: {
  list(query: CertificateQuery, signal?: AbortSignal): Promise<CertificatePage>;
  get: (id: string) => Promise<CertificateDetail>;
  issue: (payload: IssuePayload) => Promise<Certificate>;
  anchor: (id: string) => Promise<Certificate>;
  revoke: (id: string, reason?: string) => Promise<Certificate>;
  changeStatus: (id: string, status: CertificateStatus, reason?: string) => Promise<Certificate>;
  remove: (id: string) => Promise<{
    deleted: true;
    id: string;
    evidenceDeleted: boolean;
  }>;
  ensurePdf: (id: string) => Promise<Certificate>;
  downloadPdf(id: string): Promise<Blob>;
};
export declare const verificationService: {
  /** Registry + blockchain status by identifier. Makes no claim about any document. */
  byId: (id: string, signal?: AbortSignal) => Promise<Verification>;
  /** Compares a SHA-256 computed locally from the verifier's own PDF. */
  withDocumentHash: (id: string, hash: string, signal?: AbortSignal) => Promise<Verification>;
};
export declare function isNotFound(error: unknown): boolean;
export { API_URL };
