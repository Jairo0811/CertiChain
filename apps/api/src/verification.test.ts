import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildDemoCertificates } from "./demoData.js";
import { fakeRegistry, HOLDER_WALLET, isolatedStore, login, testApp, validIssuePayload } from "./test/helpers.js";

describe("public verification semantics", () => {
  it("does not claim document integrity for an identifier-only lookup", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body: issued } = await request(app).post("/api/certificates").set(auth).send(validIssuePayload);
    await request(app).post(`/api/certificates/${issued.id}/status`).set(auth).send({ status: "active" });

    const byId = await request(app).get(`/api/verify/${issued.id}`);
    expect(byId.status).toBe(200);
    expect(byId.body).toMatchObject({ valid: true, outcome: "valid", evidenceMode: "off-chain" });
    expect(byId.body.checks).toMatchObject({
      integrity: "not_evaluated",
      hashSource: "none",
      hashMatches: null,
      blockchainStatus: "not_anchored",
      statusManagedByBlockchain: false,
    });
    expect(byId.body.certificate.studentName).not.toBe(validIssuePayload.studentName);
  });

  it("compares a verifier-supplied SHA-256 and reports mismatches explicitly", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body: issued } = await request(app).post("/api/certificates").set(auth).send(validIssuePayload);
    await request(app).post(`/api/certificates/${issued.id}/status`).set(auth).send({ status: "active" });

    const match = await request(app).get(`/api/verify/${issued.id}?hash=${issued.documentHash}`);
    expect(match.body).toMatchObject({ valid: true, outcome: "valid" });
    expect(match.body.checks).toMatchObject({ integrity: "match", hashSource: "verifier", hashMatches: true });

    const mismatch = await request(app).get(`/api/verify/${issued.id}?hash=0x${"00".repeat(32)}`);
    expect(mismatch.body).toMatchObject({ valid: false, outcome: "integrity_mismatch" });
    expect(mismatch.body.checks.hashMatches).toBe(false);
  });

  it("reports pending, revoked and not-found outcomes distinctly", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body: issued } = await request(app).post("/api/certificates").set(auth).send(validIssuePayload);

    expect((await request(app).get(`/api/verify/${issued.id}`)).body.outcome).toBe("pending");
    await request(app).post(`/api/certificates/${issued.id}/revoke`).set(auth);
    expect((await request(app).get(`/api/verify/${issued.id}`)).body.outcome).toBe("revoked");

    const missing = await request(app).get("/api/verify/00000000-0000-4000-8000-000000000000");
    expect(missing.status).toBe(404);
    expect(missing.body.outcome).toBe("not_found");
  });

  it("does not assert on-chain authenticity when the blockchain cannot be consulted", async () => {
    const registry = fakeRegistry();
    const { app, store } = testApp({ registry });
    const token = await login(app);
    const { body: issued } = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validIssuePayload, studentWallet: HOLDER_WALLET });

    const verified = await request(app).get(`/api/verify/${issued.blockchainId}`);
    expect(verified.body).toMatchObject({ valid: true, outcome: "valid", evidenceMode: "on-chain" });
    expect(verified.body.checks).toMatchObject({ blockchainStatus: "verified", statusManagedByBlockchain: true });

    registry.options.verify = "throw";
    const down = await request(app).get(`/api/verify/${issued.blockchainId}`);
    expect(down.status).toBe(200);
    expect(down.body).toMatchObject({ valid: false, outcome: "blockchain_unavailable" });
    expect(down.body.checks.blockchain).toBeNull();

    const unconfigured = testApp({ store, registry: fakeRegistry({ configured: false }) });
    const notConfigured = await request(unconfigured.app).get(`/api/verify/${issued.blockchainId}`);
    expect(notConfigured.body).toMatchObject({ valid: false, outcome: "blockchain_not_configured" });

    registry.options.verify = { hashMatches: false };
    expect((await request(app).get(`/api/verify/${issued.blockchainId}`)).body.outcome).toBe("blockchain_mismatch");

    registry.options.verify = { active: false };
    expect((await request(app).get(`/api/verify/${issued.blockchainId}`)).body.outcome).toBe("revoked");
  });

  it("labels the portfolio dataset as demo, never as on-chain", async () => {
    const store = isolatedStore();
    for (const certificate of buildDemoCertificates()) await store.saveCertificate(certificate);
    const { app } = testApp({ store, registry: fakeRegistry() });

    const demo = await request(app).get("/api/verify/DEMO-0001");
    expect(demo.status).toBe(200);
    expect(demo.body).toMatchObject({ evidenceMode: "demo", outcome: "valid" });
    expect(demo.body.checks).toMatchObject({ blockchainStatus: "demo", statusManagedByBlockchain: false, blockchain: null });
  });
});
