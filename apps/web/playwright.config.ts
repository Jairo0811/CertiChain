import { defineConfig, devices } from "@playwright/test";

/**
 * End-to-end suite: real API (isolated JSON store seeded with the demo dataset) + Vite dev server
 * proxying /api, exercised in Chromium. Run with `npm run test:e2e -w @certichain/web`.
 */
const API_PORT = Number(process.env.E2E_API_PORT ?? 4310);
const WEB_PORT = Number(process.env.E2E_WEB_PORT ?? 5310);
const API_URL = `http://localhost:${API_PORT}`;

export default defineConfig({
  testDir: "./e2e",
  // The suite shares one seeded API; serial execution keeps state changes deterministic.
  workers: 1,
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  timeout: 45_000,
  expect: { timeout: 10_000 },
  reporter: process.env.CI ? [["list"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${WEB_PORT}`,
    locale: "es-DO",
    timezoneId: "America/Santo_Domingo",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: [
    {
      command: "bash e2e/start-api.sh",
      url: `${API_URL}/health`,
      env: { E2E_API_PORT: String(API_PORT), E2E_WEB_PORT: String(WEB_PORT) },
      reuseExistingServer: false,
      timeout: 60_000,
      stdout: "ignore",
      stderr: "pipe",
    },
    {
      command: `npx vite --port ${WEB_PORT} --strictPort`,
      url: `http://localhost:${WEB_PORT}`,
      env: { CERTICHAIN_API_PROXY: API_URL },
      reuseExistingServer: false,
      timeout: 60_000,
    },
  ],
});
