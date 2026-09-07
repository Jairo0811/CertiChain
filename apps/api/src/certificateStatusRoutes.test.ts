import request from "supertest";
import { describe, expect, it } from "vitest";
import { createApp } from "./app.js";
import { registerCertificateStatusRoutes } from "./certificateStatusRoutes.js";

async function loginToken(app: ReturnType<typeof createApp>): Promise<string> {
  const response = await request(app).post("/api/auth/login").send({
    email: "admin@certichain.local",
    password: "CertiChain123!",
  });
  expect(response.status).toBe(200);
  return response.body.token as string;
}

describe("certificate status management", () => {
  it("allows audited off-chain transitions between pending, active and revoked", async () => {
    const app = createApp();
    registerCertificateStatusRoutes(app);
    const token = await loginToken(app);

    const issued = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({
        studentName: "Status Demo Student",
        title: "Status Transition Credential",
        institution: "CertiChain Test Academy",
        issuedAt: "2026-09-07",
      });

    expect(issued.status).toBe(201);
    expect(issued.body.status).toBe("pending");

    const makeActive = await request(app)
      .post(`/api/certificates/${issued.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active" });
    expect(makeActive.status).toBe(200);
    expect(makeActive.body.status).toBe("active");

    const verifiedActive = await request(app).get(
      `/api/verify/${issued.body.id}?hash=${encodeURIComponent(issued.body.documentHash)}`,
    );
    expect(verifiedActive.status).toBe(200);
    expect(verifiedActive.body.valid).toBe(true);

    const revoke = await request(app)
      .post(`/api/certificates/${issued.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "revoked" });
    expect(revoke.status).toBe(200);
    expect(revoke.body.status).toBe("revoked");
    expect(revoke.body.revokedAt).toBeTruthy();

    const reactivate = await request(app)
      .post(`/api/certificates/${issued.body.id}/status`)
      .set("Authorization", `Bearer ${token}`)
      .send({ status: "active" });
    expect(reactivate.status).toBe(200);
    expect(reactivate.body.status).toBe("active");
    expect(reactivate.body.revokedAt).toBeUndefined();

    const verifiedAgain = await request(app).get(
      `/api/verify/${issued.body.id}?hash=${encodeURIComponent(issued.body.documentHash)}`,
    );
    expect(verifiedAgain.status).toBe(200);
    expect(verifiedAgain.body.valid).toBe(true);
  });

  it("rejects status changes without an administrator token", async () => {
    const app = createApp();
    registerCertificateStatusRoutes(app);

    const response = await request(app)
      .post("/api/certificates/not-authorized/status")
      .send({ status: "active" });

    expect(response.status).toBe(401);
  });
});
