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

describe("certificate cleanup", () => {
  it("deletes an off-chain test certificate and removes it from verification lookup", async () => {
    const app = createApp();
    const token = await loginToken();

    const issued = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        studentName: "Cleanup Test Student",
        title: "Temporary Test Credential",
        institution: "CertiChain Test Academy",
        issuedAt: "2026-09-07",
      });

    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe("pending");
    expect(issued.body.documentAvailable).toBe(true);

    const removed = await request(app)
      .delete(`/api/certificates/${issued.body.id}`)
      .set("Authorization", `Bearer ${token}`);

    expect(removed.status).toBe(200);
    expect(removed.body).toMatchObject({
      deleted: true,
      id: issued.body.id,
      evidenceDeleted: true,
    });

    const evidence = await request(app).get(`/api/verify/${issued.body.id}/evidence`);
    expect(evidence.status).toBe(404);
  });

  it("requires administrator authentication for destructive cleanup", async () => {
    const response = await request(createApp()).delete("/api/certificates/not-authorized");
    expect(response.status).toBe(401);
  });
});
