import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";

describe("CertiChain API", () => {
  it("reports service health", async () => {
    const response = await request(createApp()).get("/health");

    expect(response.status).toBe(200);
    expect(response.body.status).toBe("ok");
    expect(typeof response.body.blockchainConfigured).toBe("boolean");
  });

  it("rejects invalid login payloads", async () => {
    const response = await request(createApp()).post("/api/auth/login").send({ email: "invalid" });

    expect(response.status).toBe(400);
  });

  it("rejects malformed public verification requests", async () => {
    const response = await request(createApp()).get("/api/verify/not-a-certificate?hash=invalid");

    expect(response.status).toBe(400);
  });
});
