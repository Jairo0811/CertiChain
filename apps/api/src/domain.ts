export type UserRole = "admin" | "issuer" | "verifier";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export type CertificateStatus = "pending" | "active" | "revoked";

export interface CertificateRecord {
  id: string;
  blockchainId?: string;
  studentName: string;
  studentWallet: string;
  title: string;
  institution: string;
  issuedAt: string;
  documentHash: string;
  metadataURI: string;
  status: CertificateStatus;
  issuerEmail: string;
  createdAt: string;
  revokedAt?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action: "login" | "document.upload" | "certificate.issue" | "certificate.revoke" | "certificate.verify";
  entityId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
