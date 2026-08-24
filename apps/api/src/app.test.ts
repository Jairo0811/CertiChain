import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

async function loginToken(): Promise<string> {
  const response = await request(createApp()).post("/api/auth/login").send({
    email: "admin@certichain.local",
    password: "CertiChain123!",
  });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("CertiChain API", () => {
  it("reports service health", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(["json", "postgres"]).toContain(response.body.persistence);
    expect(typeof response.body.blockchainConfigured).toBe("boolean");
  });

  it("reports readiness when persistence is available", async () => {
    const response = await request(createApp()).get("/ready");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ready");
    expect(response.body.persistenceReady).toBe(true);
  });

  it("rejects invalid login payloads", async () => {
    const response = await request(createApp()).post("/api/auth/login").send({ email: "invalid" });

    expect(response.status).toBe(400);
  });

  it("rejects malformed public verification requests", async () => {
    const response = await request(createApp()).get("/api/verify/not-a-certificate?hash=invalid");

    expect(response.status).toBe(400);
  });

  it("encrypts and stores an authenticated certificate document", async () => {
    const token = await loginToken();
    const response = await request(createApp())
      .post("/api/documents")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/pdf")
      .set("X-File-Name", "certificate.pdf")
      .send(Buffer.from("%PDF-1.4 CertiChain test certificate"));

    expect(response.status).toBe(201);
    expect(response.body.documentHash).toMatch(/^0x[a-f0-9]{64}$/);
    expect(response.body.metadataURI).toMatch(/^local-encrypted:\/\//);
    expect(response.body.encryption).toBe("AES-256-GCM");
  });

  it("exposes Prometheus metrics", async () => {
    const response = await request(createApp()).get("/metrics");

    expect(response.status).toBe(200);
    expect(response.text).toContain("certichain_http_requests_total");
  });
});
