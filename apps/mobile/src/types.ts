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

export type Verification = {
  valid: boolean;
  certificate?: Certificate;
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean;
    blockchain: BlockchainVerification;
  };
};

export type WalletCredential = Certificate & {
  documentHash: string;
  savedAt: string;
  verifiedAt: string;
};

export type ConnectionState = "checking" | "connected" | "offline" | "unconfigured";
