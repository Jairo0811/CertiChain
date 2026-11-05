import type { Certificate, SortField } from "../../types";
export declare function CertificateTable({ items, sort, direction, onSort, onOpen, onValidate, onDownload, onRevoke, onDelete, onAnchor, canManage, isAdmin, working, }: {
    items: Certificate[];
    sort: SortField;
    direction: "asc" | "desc";
    onSort: (field: SortField) => void;
    onOpen: (certificate: Certificate) => void;
    onValidate: (certificate: Certificate) => void;
    onDownload: (certificate: Certificate) => void;
    onRevoke: (certificate: Certificate) => void;
    onDelete: (certificate: Certificate) => void;
    onAnchor: (certificate: Certificate) => void;
    canManage: boolean;
    isAdmin: boolean;
    working: string | null;
}): import("react").JSX.Element;
