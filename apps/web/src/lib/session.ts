import type { Session } from "../types";

const KEY = "certichain-session";
/** Legacy key written by earlier releases (token only). Cleared on read. */
const LEGACY_KEY = "certichain-token";

/**
 * The session lives in sessionStorage: it disappears with the tab and is never shared across tabs.
 * The token is still readable by scripts on this origin, so the CSP served by nginx matters.
 */
export function loadSession(): Session | null {
  try {
    sessionStorage.removeItem(LEGACY_KEY);
    const raw = sessionStorage.getItem(KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as Session;
    if (!session.token || !session.expiresAt || !session.user?.email) return null;
    if (Date.parse(session.expiresAt) <= Date.now()) {
      sessionStorage.removeItem(KEY);
      return null;
    }
    return session;
  } catch {
    return null;
  }
}

export function saveSession(session: Session): void {
  try {
    sessionStorage.setItem(KEY, JSON.stringify(session));
  } catch {
    // Private mode / storage disabled: the session simply lasts for this page view.
  }
}

export function clearSession(): void {
  try {
    sessionStorage.removeItem(KEY);
    sessionStorage.removeItem(LEGACY_KEY);
  } catch {
    // ignore
  }
}
