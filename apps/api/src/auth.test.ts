import jwt from "jsonwebtoken";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { config } from "./config.js";
import { login, testApp, validIssuePayload } from "./test/helpers.js";

describe("authentication and authorization", () => {
  it("returns the same generic error for unknown email and wrong password", async () => {
    const { app } = testApp();
    const unknown = await request(app).post("/api/auth/login").send({ email: "nobody@certichain.local", password: "CertiChain123!" });
    const wrong = await request(app).post("/api/auth/login").send({ email: "admin@certichain.local", password: "not-the-password" });
    expect(unknown.status).toBe(401);
    expect(wrong.status).toBe(401);
    expect(unknown.body.error).toBe(wrong.body.error);
    expect(unknown.body.code).toBe("invalid_credentials");
  });

  it("issues a token with an explicit expiry and exposes the session", async () => {
    const { app } = testApp();
    const response = await request(app).post("/api/auth/login").send({ email: "ADMIN@certichain.local", password: "CertiChain123!" });
    expect(response.status).toBe(200);
    expect(Date.parse(response.body.expiresAt)).toBeGreaterThan(Date.now());
    expect(response.body.user).toMatchObject({ email: "admin@certichain.local", role: "admin" });

    const session = await request(app).get("/api/auth/session").set("Authorization", `Bearer ${response.body.token}`);
    expect(session.status).toBe(200);
    expect(session.body.user.role).toBe("admin");
  });

  it("distinguishes expired sessions from invalid tokens", async () => {
    const { app } = testApp();
    const expired = jwt.sign({ email: "admin@certichain.local", role: "admin" }, config.JWT_SECRET, {
      algorithm: "HS256",
      expiresIn: -10,
      issuer: "certichain-api",
      audience: "certichain-portal",
      subject: "local-admin",
    });
    const expiredResponse = await request(app).get("/api/certificates").set("Authorization", `Bearer ${expired}`);
    expect(expiredResponse.status).toBe(401);
    expect(expiredResponse.body.code).toBe("session_expired");

    const forged = jwt.sign({ email: "admin@certichain.local", role: "admin" }, "attacker-controlled-secret-value", {
      issuer: "certichain-api",
      audience: "certichain-portal",
      subject: "local-admin",
    });
    const forgedResponse = await request(app).get("/api/certificates").set("Authorization", `Bearer ${forged}`);
    expect(forgedResponse.status).toBe(401);
    expect(forgedResponse.body.code).toBe("unauthenticated");
  });

  it("rejects unsigned tokens and tokens with unexpected claims", async () => {
    const { app } = testApp();
    const unsigned = jwt.sign({ email: "admin@certichain.local", role: "admin" }, "", {
      algorithm: "none",
      issuer: "certichain-api",
      audience: "certichain-portal",
    });
    expect((await request(app).get("/api/certificates").set("Authorization", `Bearer ${unsigned}`)).status).toBe(401);

    const superuser = jwt.sign({ email: "admin@certichain.local", role: "superuser" }, config.JWT_SECRET, {
      algorithm: "HS256",
      issuer: "certichain-api",
      audience: "certichain-portal",
      subject: "x",
    });
    expect((await request(app).get("/api/certificates").set("Authorization", `Bearer ${superuser}`)).status).toBe(401);
  });

  it("enforces roles per operation", async () => {
    const { app } = testApp();
    const verifier = jwt.sign({ email: "auditor@certichain.local", role: "verifier" }, config.JWT_SECRET, {
      algorithm: "HS256",
      issuer: "certichain-api",
      audience: "certichain-portal",
      subject: "verifier-1",
    });
    const auth = { Authorization: `Bearer ${verifier}` };

    expect((await request(app).get("/api/certificates").set(auth)).status).toBe(200);
    const issue = await request(app).post("/api/certificates").set(auth).send(validIssuePayload);
    expect(issue.status).toBe(403);
    expect(issue.body.code).toBe("forbidden");
    expect((await request(app).delete("/api/certificates/abc").set(auth)).status).toBe(403);
    expect((await request(app).get("/api/audit").set(auth)).status).toBe(403);
  });

  it("returns a uniform error envelope with a correlation id", async () => {
    const { app } = testApp();
    const token = await login(app);
    const response = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .set("X-Request-Id", "trace-test-1")
      .send({ ...validIssuePayload, studentName: "" });
    expect(response.status).toBe(400);
    expect(response.body).toMatchObject({ code: "validation_failed", requestId: "trace-test-1" });
    expect(response.body.details.fieldErrors.studentName).toBeDefined();
  });
});
