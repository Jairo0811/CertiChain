import type { ReactNode } from "react";
import { IconName } from "./Icon";
export declare function Spinner({ label }: {
    label?: string;
}): import("react").JSX.Element;
export declare function EmptyState({ icon, title, children, action }: {
    icon?: IconName;
    title: string;
    children?: ReactNode;
    action?: ReactNode;
}): import("react").JSX.Element;
export declare function ErrorState({ message, onRetry }: {
    message: string;
    onRetry?: () => void;
}): import("react").JSX.Element;
export declare function Brand({ compact }: {
    compact?: boolean;
}): import("react").JSX.Element;
