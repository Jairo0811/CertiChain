import type { Certificate } from "../types";
/**
 * Certificate operations shared by the table and the detail drawer. Destructive operations go
 * through ConfirmDialog; every outcome is announced via the toast live region and followed by
 * `onChanged` so lists and the dashboard refresh from the server.
 */
export declare function useCertificateActions(onChanged: (certificate?: Certificate, removedId?: string) => void): {
    working: string | null;
    dialog: import("react").JSX.Element | null;
    downloadPdf: (certificate: Certificate) => Promise<void>;
    anchor: (certificate: Certificate) => Promise<void>;
    requestRevoke: (certificate: Certificate) => void;
    requestDelete: (certificate: Certificate) => void;
};
export declare function canDelete(certificate: Certificate): boolean;
export declare function canGeneratePdf(certificate: Certificate): boolean;
export declare function needsAnchoring(certificate: Certificate): boolean;
