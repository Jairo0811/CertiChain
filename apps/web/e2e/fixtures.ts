import { test as base, expect, type APIRequestContext, type Page } from "@playwright/test";

export const ADMIN = { email: "admin@certichain.local", password: "CertiChain123!" };

interface Session {
  token: string;
  expiresAt: string;
  user: { id: string; email: string; role: string };
}

async function login(request: APIRequestContext): Promise<Session> {
  const response = await request.post("/api/auth/login", { data: ADMIN });
  expect(response.ok()).toBeTruthy();
  return (await response.json()) as Session;
}

/**
 * - `session`: one API login per worker (stays well under the login rate limit).
 * - `portal`: a page already signed in, by writing the session the app keeps in sessionStorage.
 * - `api`: authenticated request helper for arranging test data.
 */
export const test = base.extend<
  { portal: Page; api: { issue: (title: string) => Promise<{ id: string; documentHash: string }> } },
  { session: Session }
>({
  session: [
    async ({ playwright }, use, workerInfo) => {
      const request = await playwright.request.newContext({ baseURL: workerInfo.project.use.baseURL });
      await use(await login(request));
      await request.dispose();
    },
    { scope: "worker" },
  ],
  portal: async ({ page, session }, use) => {
    await page.addInitScript((value) => {
      window.sessionStorage.setItem("certichain-session", value);
    }, JSON.stringify(session));
    await use(page);
  },
  api: async ({ request, session }, use) => {
    await use({
      async issue(title: string) {
        const response = await request.post("/api/certificates", {
          headers: { Authorization: `Bearer ${session.token}` },
          data: { studentName: "Prueba E2E", title, institution: "Universidad APEC (UNAPEC)", issuedAt: "2026-09-01" },
        });
        expect(response.status()).toBe(201);
        return (await response.json()) as { id: string; documentHash: string };
      },
    });
  },
});

export { expect };

/** Unique, readable suffix so tests never collide with demo data or previous runs. */
export function uniqueTitle(prefix: string): string {
  return `${prefix} ${Date.now().toString(36)}`;
}

/** Fails if the page scrolls horizontally (layout overflow). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth);
  expect(overflow).toBeLessThanOrEqual(0);
}
