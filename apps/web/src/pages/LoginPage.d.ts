import type { Session } from "../types";
export declare function LoginPage({ onAuthenticated, notice }: {
    onAuthenticated: (session: Session) => void;
    notice?: string;
}): import("react").JSX.Element;
