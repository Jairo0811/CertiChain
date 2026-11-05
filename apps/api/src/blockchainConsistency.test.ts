import request from "supertest";
import { describe, expect, it } from "vitest";
import { fakeRegistry, HOLDER_WALLET, login, testApp, validIssuePayload } from "./test/helpers.js";

const onChainPayload = { ...validIssuePayload, studentWallet: HOLDER_WALLET };

describe("blockchain issuance consistency", () => {
  it("requires a holder wallet when the registry is configured", async () => {
    const { app } = testApp({ registry: fakeRegistry() });
    const token = await login(app);
    const response = await request(app).post("/api/certificates").set("Authorization", `Bearer ${token}`).send(validIssuePayload);
    expect(response.status).toBe(400);
    expect(response.body.details.fieldErrors.studentWallet).toBeDefined();
  });

  it("persists before anchoring and activates only after confirmation", async () => {
    const registry = fakeRegistry();
    const { app, store } = testApp({ registry });
    const token = await login(app);

    const response = await request(app).post("/api/certificates").set("Authorization", `Bearer ${token}`).send(onChainPayload);
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({
      status: "active",
      chainSyncStatus: "anchored",
      evidenceMode: "on-chain",
      statusManagedByBlockchain: true,
    });
    expect(response.body.blockchainId).toMatch(/^0x[0-9a-f]{64}$/);
    expect(response.body.chainTxHash).toMatch(/^0x[0-9a-f]{64}$/);
    expect(registry.calls.submit).toBe(1);

    const stored = await store.getCertificate(response.body.id);
    expect(stored?.chainSyncStatus).toBe("anchored");
  });

  it("keeps a recoverable pending record when the RPC rejects the transaction", async () => {
    const registry = fakeRegistry({ submit: "reject" });
    const { app, store } = testApp({ registry });
    const token = await login(app);

    const response = await request(app).post("/api/certificates").set("Authorization", `Bearer ${token}`).send(onChainPayload);
    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ status: "pending", chainSyncStatus: "failed" });
    expect(response.body.chainError).toBe("Blockchain RPC unreachable");
    expect(response.body.chainError).not.toMatch(/127\.0\.0\.1/);
    expect(await store.getCertificate(response.body.id)).toBeDefined();

    // RPC back online → retry anchors exactly once.
    registry.options.submit = "ok";
    const retried = await request(app)
      .post(`/api/certificates/${response.body.id}/anchor`)
      .set("Authorization", `Bearer ${token}`);
    expect(retried.status).toBe(200);
    expect(retried.body).toMatchObject({ status: "active", chainSyncStatus: "anchored" });
    expect(registry.calls.submit).toBe(2);
  });

  it("never re-sends a submitted transaction; reconciliation looks up the receipt", async () => {
    const registry = fakeRegistry({ submit: "confirm-timeout" });
    const { app } = testApp({ registry });
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };

    const response = await request(app).post("/api/certificates").set(auth).send(onChainPayload);
    expect(response.status).toBe(202);
    expect(response.body).toMatchObject({ status: "pending", chainSyncStatus: "submitted" });
    expect(response.body.chainTxHash).toBeTruthy();

    // Still pending on-chain: nothing changes, nothing is re-sent.
    const pending = await request(app).post(`/api/certificates/${response.body.id}/anchor`).set(auth);
    expect(pending.status).toBe(202);
    expect(registry.calls.submit).toBe(1);

    // Mined later: reconciliation finalizes using the stored tx hash.
    registry.options.receipt = { state: "confirmed", certificateId: `0x${"e".repeat(64)}` };
    const confirmed = await request(app).post(`/api/certificates/${response.body.id}/anchor`).set(auth);
    expect(confirmed.status).toBe(200);
    expect(confirmed.body).toMatchObject({ status: "active", chainSyncStatus: "anchored", blockchainId: `0x${"e".repeat(64)}` });
    expect(registry.calls.submit).toBe(1);

    // Idempotent afterwards.
    const again = await request(app).post(`/api/certificates/${response.body.id}/anchor`).set(auth);
    expect(again.status).toBe(200);
    expect(registry.calls.submit).toBe(1);
  });

  it("blocks manual status changes, deletion and early revocation while anchoring is in flight", async () => {
    const registry = fakeRegistry({ submit: "confirm-timeout" });
    const { app } = testApp({ registry });
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body } = await request(app).post("/api/certificates").set(auth).send(onChainPayload);

    expect((await request(app).post(`/api/certificates/${body.id}/status`).set(auth).send({ status: "active" })).status).toBe(
      409,
    );
    expect((await request(app).delete(`/api/certificates/${body.id}`).set(auth)).status).toBe(409);
    expect((await request(app).post(`/api/certificates/${body.id}/revoke`).set(auth)).status).toBe(409);
  });
});

describe("on-chain revocation and status governance", () => {
  async function anchored() {
    const registry = fakeRegistry();
    const { app, store } = testApp({ registry });
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body } = await request(app).post("/api/certificates").set(auth).send(onChainPayload);
    return { app, store, registry, auth, certificate: body };
  }

  it("revokes on-chain before updating the registry and never allows reactivation", async () => {
    const { app, registry, auth, certificate } = await anchored();

    const revoked = await request(app)
      .post(`/api/certificates/${certificate.id}/revoke`)
      .set(auth)
      .send({ reason: "Emitido con datos incorrectos" });
    expect(revoked.status).toBe(200);
    expect(revoked.body.status).toBe("revoked");
    expect(revoked.body.chainRevokeTxHash).toBeTruthy();
    expect(registry.calls.revoke).toBe(1);

    const reactivate = await request(app)
      .post(`/api/certificates/${certificate.id}/status`)
      .set(auth)
      .send({ status: "active", reason: "intento de reactivación" });
    expect(reactivate.status).toBe(409);
    expect((await request(app).delete(`/api/certificates/${certificate.id}`).set(auth)).status).toBe(409);
  });

  it("only syncs the registry when the credential is already revoked on-chain", async () => {
    const { app, registry, auth, certificate } = await anchored();
    registry.options.verify = { active: false, revokedAt: 10 };
    const revoked = await request(app).post(`/api/certificates/${certificate.id}/revoke`).set(auth);
    expect(revoked.status).toBe(200);
    expect(registry.calls.revoke).toBe(0);
  });

  it("refuses to revoke an anchored credential off-chain only", async () => {
    const { app, store, auth, certificate } = await anchored();
    const offline = testApp({ store, registry: fakeRegistry({ configured: false }) });
    const response = await request(offline.app).post(`/api/certificates/${certificate.id}/revoke`).set(auth);
    expect(response.status).toBe(503);
    expect(response.body.code).toBe("blockchain_not_configured");
    expect((await store.getCertificate(certificate.id))?.status).toBe("active");

    const rpcDown = testApp({ store, registry: fakeRegistry({ verify: "throw" }) });
    const failed = await request(rpcDown.app).post(`/api/certificates/${certificate.id}/revoke`).set(auth);
    expect(failed.status).toBe(503);
    expect(failed.body.code).toBe("blockchain_unavailable");
    expect((await store.getCertificate(certificate.id))?.status).toBe("active");
    void app;
  });

  it("serializes concurrent revocations into a single blockchain transaction", async () => {
    const { app, registry, auth, certificate } = await anchored();
    const [first, second] = await Promise.all([
      request(app).post(`/api/certificates/${certificate.id}/revoke`).set(auth),
      request(app).post(`/api/certificates/${certificate.id}/revoke`).set(auth),
    ]);
    expect([first.status, second.status].sort()).toEqual([200, 409]);
    expect(registry.calls.revoke).toBe(1);
  });
});
