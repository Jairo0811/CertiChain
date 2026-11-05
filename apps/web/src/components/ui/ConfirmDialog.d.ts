import { ReactNode } from "react";
/**
 * Explicit confirmation for destructive or irreversible operations. Optionally requires a
 * written reason and/or typing a confirmation word before the action is enabled.
 */
export declare function ConfirmDialog({ title, children, confirmLabel, tone, requireReason, reasonLabel, reasonHint, confirmWord, busy, error, onConfirm, onCancel, }: {
    title: string;
    children: ReactNode;
    confirmLabel: string;
    tone?: "danger" | "primary";
    requireReason?: "required" | "optional";
    reasonLabel?: string;
    reasonHint?: string;
    confirmWord?: string;
    busy?: boolean;
    error?: string;
    onConfirm: (reason?: string) => void;
    onCancel: () => void;
}): import("react").JSX.Element;
