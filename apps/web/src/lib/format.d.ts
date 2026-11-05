import type { AuditAction, BlockchainCheck, Certificate, CertificateStatus, EvidenceMode, VerificationOutcome } from "../types";
/** Academic dates (YYYY-MM-DD) are calendar dates; format them in UTC to avoid off-by-one days. */
export declare function formatDate(value: string, long?: boolean): string;
export declare function formatDateTime(value: string): string;
export declare function formatRelative(value: string, now?: number): string;
export declare function shortHash(value: string, head?: number, tail?: number): string;
export declare function publicId(certificate: Pick<Certificate, "id" | "blockchainId">): string;
export declare const STATUS_LABEL: Record<CertificateStatus, string>;
export declare const MODE_LABEL: Record<EvidenceMode, string>;
export declare const MODE_DESCRIPTION: Record<EvidenceMode, string>;
export declare const OUTCOME_COPY: Record<VerificationOutcome, {
    title: string;
    body: string;
    tone: "success" | "warning" | "danger" | "neutral";
}>;
export declare const BLOCKCHAIN_CHECK_COPY: Record<BlockchainCheck, {
    label: string;
    state: "ok" | "fail" | "skip" | "warn";
}>;
export declare const ACTION_LABEL: Partial<Record<AuditAction, string>>;
export declare function pdfFilename(certificate: Pick<Certificate, "title" | "id">): string;
export declare function verifyUrl(id: string): string;
