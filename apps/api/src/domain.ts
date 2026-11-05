export type UserRole = "admin" | "issuer" | "verifier";

export interface AuthUser {
  id: string;
  email: string;
  role: UserRole;
}

export type CertificateStatus = "pending" | "active" | "revoked";

/**
 * Where the authoritative evidence of a credential lives.
 * - on-chain: anchored in CertificateRegistry (bytes32 blockchain id).
 * - demo: portfolio dataset with an illustrative identifier; never anchored.
 * - off-chain: local/off-chain record only.
 */
export type EvidenceMode = "on-chain" | "demo" | "off-chain";

/**
 * Lifecycle of the blockchain anchoring for a credential.
 * - not_requested: blockchain integration was not used for this credential.
 * - submitting: persisted off-chain, transaction not yet accepted by the RPC.
 * - submitted: transaction hash known, confirmation pending. Never re-sent.
 * - anchored: CertificateIssued event confirmed; blockchainId stored.
 * - failed: transaction was never accepted (no tx hash); safe to retry.
 */
export type ChainSyncStatus = "not_requested" | "submitting" | "submitted" | "anchored" | "failed";

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
  chainSyncStatus?: ChainSyncStatus;
  chainTxHash?: string;
  chainRevokeTxHash?: string;
  chainError?: string;
  updatedAt?: string;
}

export interface AuditEvent {
  id: string;
  actor: string;
  action:
    | "login"
    | "document.upload"
    | "certificate.issue"
    | "certificate.revoke"
    | "certificate.status"
    | "certificate.anchor"
    | "certificate.delete"
    | "certificate.verify";
  entityId?: string;
  timestamp: string;
  metadata?: Record<string, unknown>;
}
