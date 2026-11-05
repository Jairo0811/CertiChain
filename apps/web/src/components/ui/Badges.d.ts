import type { CertificateStatus, ChainSyncStatus, EvidenceMode } from "../../types";
export declare function StatusBadge({ status }: {
    status: CertificateStatus;
}): import("react").JSX.Element;
export declare function ModeBadge({ mode }: {
    mode: EvidenceMode;
}): import("react").JSX.Element;
declare const SYNC_LABEL: Record<ChainSyncStatus, string>;
export declare function SyncBadge({ status }: {
    status?: ChainSyncStatus;
}): import("react").JSX.Element | null;
export { SYNC_LABEL };
