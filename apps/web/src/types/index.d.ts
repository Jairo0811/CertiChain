/** Contracts shared with apps/api. Kept in one place to avoid drifting per-component copies. */
export type CertificateStatus = "pending" | "active" | "revoked";
export type EvidenceMode = "on-chain" | "demo" | "off-chain";
export type ChainSyncStatus = "not_requested" | "submitting" | "submitted" | "anchored" | "failed";
export interface Certificate {
    id: string;
    blockchainId?: string;
    studentName: string;
    studentWallet: string;
    title: string;
    institution: string;
    issuedAt: string;
    documentHash: string;
    metadataURI: string;
    documentAvailable: boolean;
    status: CertificateStatus;
    issuerEmail: string;
    createdAt: string;
    revokedAt?: string;
    evidenceMode: EvidenceMode;
    statusManagedByBlockchain: boolean;
    chainSyncStatus?: ChainSyncStatus;
    chainTxHash?: string;
    chainRevokeTxHash?: string;
    chainError?: string;
}
export type AuditAction = "login" | "document.upload" | "certificate.issue" | "certificate.revoke" | "certificate.status" | "certificate.anchor" | "certificate.delete" | "certificate.verify";
export interface AuditEvent {
    id: string;
    actor: string;
    action: AuditAction;
    entityId?: string;
    timestamp: string;
    metadata?: Record<string, unknown>;
}
export interface CertificateDetail extends Certificate {
    history: AuditEvent[];
}
export interface CertificatePage {
    items: Certificate[];
    total: number;
    page: number;
    pageSize: number;
    totalPages: number;
}
export type SortField = "createdAt" | "issuedAt" | "studentName" | "title" | "institution" | "status";
export interface CertificateQuery {
    page: number;
    pageSize: number;
    search?: string;
    status?: CertificateStatus;
    sort: SortField;
    direction: "asc" | "desc";
}
export type VerificationOutcome = "valid" | "pending" | "revoked" | "not_found" | "integrity_mismatch" | "blockchain_mismatch" | "blockchain_not_configured" | "blockchain_unavailable";
export type IntegrityCheck = "match" | "mismatch" | "not_evaluated";
export type BlockchainCheck = "verified" | "hash_mismatch" | "revoked_on_chain" | "not_found_on_chain" | "not_configured" | "unavailable" | "not_anchored" | "demo";
export interface Verification {
    valid: boolean;
    outcome: VerificationOutcome;
    evidenceMode: EvidenceMode;
    verifiedAt: string;
    certificate: {
        id: string;
        blockchainId?: string;
        studentName: string;
        title: string;
        institution: string;
        issuedAt: string;
        status: CertificateStatus;
        revokedAt?: string;
        evidenceMode: EvidenceMode;
    };
    checks: {
        existsOffChain: boolean;
        registryStatus: CertificateStatus;
        integrity: IntegrityCheck;
        hashSource: "verifier" | "none";
        hashMatches: boolean | null;
        blockchainStatus: BlockchainCheck;
        statusManagedByBlockchain: boolean;
    };
}
export type DashboardRange = "30" | "90" | "365" | "all";
export interface DashboardSummary {
    range: {
        key: DashboardRange;
        from: string | null;
        to: string;
        dateBasis: "issuedAt";
        granularity: "day" | "week" | "month";
    };
    period: {
        issued: number;
        active: number;
        pending: number;
        revoked: number;
        institutions: number;
        revocationsInRange: number;
        onChain: number;
    };
    allTime: {
        total: number;
        active: number;
        pending: number;
        revoked: number;
        institutions: number;
    };
    trend: {
        previousIssued: number;
        changePercent: number;
    } | null;
    series: Array<{
        key: string;
        label: string;
        start: string;
        issued: number;
    }>;
    byInstitution: Array<{
        institution: string;
        issued: number;
    }>;
    activity: Array<{
        id: string;
        action: AuditAction;
        actor: string;
        timestamp: string;
        certificateId?: string;
        title?: string;
        studentName?: string;
        metadata?: Record<string, unknown>;
    }>;
}
export interface SessionUser {
    id: string;
    email: string;
    role: "admin" | "issuer" | "verifier";
}
export interface Session {
    token: string;
    expiresAt: string;
    user: SessionUser;
}
export interface Health {
    status: string;
    persistence: "json" | "postgres";
    storage: "local" | "ipfs";
    blockchainConfigured: boolean;
}
