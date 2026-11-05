import type { SessionUser } from "../types";
export declare function CertificatesPage({ user, openId, onOpenChange, onIssue, }: {
    user: SessionUser;
    openId: {
        id: string;
        validate?: boolean;
    } | null;
    onOpenChange: (value: {
        id: string;
        validate?: boolean;
    } | null) => void;
    onIssue: () => void;
}): import("react").JSX.Element;
