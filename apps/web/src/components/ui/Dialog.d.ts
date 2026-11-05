import { ReactNode } from "react";
/**
 * Accessible modal surface used by both centered dialogs and side drawers:
 * focus moves inside on open, Tab is trapped, Escape closes, focus returns to the trigger.
 */
export declare function Dialog({ title, description, onClose, children, variant, size, footer, closeLabel, dismissible, }: {
    title: ReactNode;
    description?: ReactNode;
    onClose: () => void;
    children?: ReactNode;
    variant?: "dialog" | "drawer";
    size?: "sm" | "md" | "lg";
    footer?: ReactNode;
    closeLabel?: string;
    dismissible?: boolean;
}): import("react").JSX.Element;
