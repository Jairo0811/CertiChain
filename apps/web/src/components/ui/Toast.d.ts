import { ReactNode } from "react";
type Tone = "success" | "error" | "info";
/** Polite live region so screen readers announce results of actions without stealing focus. */
export declare function ToastProvider({ children }: { children: ReactNode }): import("react").JSX.Element;
export declare function useToast(): (message: string, tone?: Tone) => void;
export {};
