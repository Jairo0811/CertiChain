import express from "express";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { parseTrustProxy, rateLimit, requestSecurity } from "./security.js";
import { testApp } from "./test/helpers.js";

function limitedApp(trustProxy: boolean | number = false) {
  const app = express();
  app.set("trust proxy", trustProxy);
  const limiter = rateLimit({ name: "test", windowMs: 60_000, max: 2, maxKeys: 3 });
  app.get("/", limiter, (_req, res) => {
    res.json({ ok: true });
  });
  return { app, limiter };
}

describe("rate limiting", () => {
  it("keeps login, verification and general API budgets isolated", async () => {
    const { app } = testApp({
      rateLimits: {
        api: { windowMs: 60_000, max: 2 },
        login: { windowMs: 60_000, max: 2 },
        verify: { windowMs: 60_000, max: 2 },
      },
    });

    // Exhaust the general API budget.
    for (let index = 0; index < 2; index += 1) {
      expect((await request(app).get("/api/certificates")).status).toBe(401);
    }
    expect((await request(app).get("/api/certificates")).status).toBe(429);

    // Login and verification still have their full, independent budgets.
    expect(
      (await request(app).post("/api/auth/login").send({ email: "someone@example.com", password: "wrong-pass" })).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/auth/login").send({ email: "someone@example.com", password: "wrong-pass" })).status,
    ).toBe(401);
    expect(
      (await request(app).post("/api/auth/login").send({ email: "someone@example.com", password: "wrong-pass" })).status,
    ).toBe(429);

    expect((await request(app).get("/api/verify/unknown-id")).status).toBe(404);
    expect((await request(app).get("/api/verify/unknown-id")).status).toBe(404);
    const blocked = await request(app).get("/api/verify/unknown-id");
    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe("rate_limited");
    expect(blocked.headers["retry-after"]).toBeDefined();
  });

  it("ignores a spoofed X-Forwarded-For header unless a proxy is trusted", async () => {
    const { app } = limitedApp(false);
    await request(app).get("/").set("X-Forwarded-For", "1.1.1.1");
    await request(app).get("/").set("X-Forwarded-For", "2.2.2.2");
    const third = await request(app).get("/").set("X-Forwarded-For", "3.3.3.3");
    expect(third.status).toBe(429);
  });

  it("uses the forwarded client address when one proxy hop is trusted", async () => {
    const { app } = limitedApp(1);
    await request(app).get("/").set("X-Forwarded-For", "1.1.1.1");
    await request(app).get("/").set("X-Forwarded-For", "1.1.1.1");
    expect((await request(app).get("/").set("X-Forwarded-For", "1.1.1.1")).status).toBe(429);
    expect((await request(app).get("/").set("X-Forwarded-For", "2.2.2.2")).status).toBe(200);
  });

  it("bounds the number of tracked clients", async () => {
    const { app, limiter } = limitedApp(1);
    for (let index = 0; index < 10; index += 1) {
      await request(app).get("/").set("X-Forwarded-For", `10.0.0.${index}`);
    }
    expect(limiter.size()).toBeLessThanOrEqual(3);
  });

  it("parses TRUST_PROXY values explicitly", () => {
    expect(parseTrustProxy(undefined)).toBe(false);
    expect(parseTrustProxy("")).toBe(false);
    expect(parseTrustProxy("false")).toBe(false);
    expect(parseTrustProxy("true")).toBe(true);
    expect(parseTrustProxy("1")).toBe(1);
    expect(parseTrustProxy("loopback, 10.0.0.0/8")).toBe("loopback, 10.0.0.0/8");
  });
});

describe("request security headers", () => {
  it("reflects only safe correlation ids", async () => {
    const app = express();
    app.use(requestSecurity);
    app.get("/", (_req, res) => {
      res.json({ ok: true });
    });

    const safe = await request(app).get("/").set("X-Request-Id", "trace-123");
    expect(safe.headers["x-request-id"]).toBe("trace-123");

    const unsafe = await request(app).get("/").set("X-Request-Id", "<script>alert(1)</script>");
    expect(unsafe.headers["x-request-id"]).not.toContain("<");
  });
});
