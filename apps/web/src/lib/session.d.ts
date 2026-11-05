import type { Session } from "../types";
/**
 * The session lives in sessionStorage: it disappears with the tab and is never shared across tabs.
 * The token is still readable by scripts on this origin, so the CSP served by nginx matters.
 */
export declare function loadSession(): Session | null;
export declare function saveSession(session: Session): void;
export declare function clearSession(): void;
