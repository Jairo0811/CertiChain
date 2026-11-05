export type CertificateStatus = "pending" | "active" | "revoked";

export type Certificate = {
  id: string;
  blockchainId?: string;
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  status: CertificateStatus;
};

export type BlockchainVerification = {
  exists?: boolean;
  active?: boolean;
  hashMatches?: boolean;
} | null;

export type EvidenceMode = "on-chain" | "demo" | "off-chain";

export type VerificationOutcome =
  | "valid"
  | "pending"
  | "revoked"
  | "not_found"
  | "integrity_mismatch"
  | "blockchain_mismatch"
  | "blockchain_not_configured"
  | "blockchain_unavailable";

export type IntegrityCheck = "match" | "mismatch" | "not_evaluated";

export type BlockchainCheck =
  | "verified"
  | "hash_mismatch"
  | "revoked_on_chain"
  | "not_found_on_chain"
  | "not_configured"
  | "unavailable"
  | "not_anchored"
  | "demo";

/**
 * API verification result. New fields are optional so the app still understands older API
 * versions that only returned `valid` + boolean checks.
 */
export type Verification = {
  valid: boolean;
  outcome?: VerificationOutcome;
  evidenceMode?: EvidenceMode;
  verifiedAt?: string;
  certificate?: Certificate & { evidenceMode?: EvidenceMode; revokedAt?: string };
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean | null;
    blockchain: BlockchainVerification;
    registryStatus?: CertificateStatus;
    integrity?: IntegrityCheck;
    hashSource?: "verifier" | "none";
    blockchainStatus?: BlockchainCheck;
    statusManagedByBlockchain?: boolean;
  };
};

/**
 * What the device actually observed during the last verification. Stored verbatim so the detail
 * screen never fabricates "current" checks from cached data.
 */
export type VerificationSnapshot = {
  verifiedAt: string;
  valid: boolean;
  outcome: VerificationOutcome;
  status: CertificateStatus;
  evidenceMode?: EvidenceMode;
  integrity: IntegrityCheck;
  hashSource: "link" | "none";
  blockchainStatus?: BlockchainCheck;
};

export type WalletCredential = Certificate & {
  /** Registered SHA-256 (reference value copied from the registry, not a check result). */
  documentHash: string;
  savedAt: string;
  verifiedAt: string;
  lastVerification?: VerificationSnapshot;
};

export type ConnectionState = "checking" | "connected" | "offline" | "unconfigured";
