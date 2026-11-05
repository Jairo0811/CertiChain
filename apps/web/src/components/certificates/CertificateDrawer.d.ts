import type { Certificate } from "../../types";
export declare function CertificateDrawer({ id, validateOnOpen, refreshKey, isAdmin, canManage, working, onClose, onChanged, onDownload, onAnchor, onRevoke, onDelete, }: {
    id: string;
    validateOnOpen?: boolean;
    refreshKey: number;
    isAdmin: boolean;
    canManage: boolean;
    working: string | null;
    onClose: () => void;
    onChanged: (certificate: Certificate) => void;
    onDownload: (certificate: Certificate) => void;
    onAnchor: (certificate: Certificate) => void;
    onRevoke: (certificate: Certificate) => void;
    onDelete: (certificate: Certificate) => void;
}): import("react").JSX.Element;
