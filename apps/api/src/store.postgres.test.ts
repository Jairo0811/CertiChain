import pg from "pg";
import request from "supertest";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { buildDemoCertificates } from "./demoData.js";
import type { CertificateRecord } from "./domain.js";
import { migrations } from "./migrations.js";
import { PostgresStore } from "./store.js";
import { fakeRegistry, HOLDER_WALLET, login, testApp, validIssuePayload } from "./test/helpers.js";

/**
 * Integration tests against a real PostgreSQL server.
 * Enabled when TEST_DATABASE_URL points to a disposable database (CI provides a service container).
 */
const databaseUrl = process.env.TEST_DATABASE_URL;

describe.skipIf(!databaseUrl)("PostgresStore (real PostgreSQL)", () => {
  let store: PostgresStore;

  beforeAll(async () => {
    const admin = new pg.Client({ connectionString: databaseUrl });
    await admin.connect();
    await admin.query("DROP TABLE IF EXISTS certificates, audit_events, schema_migrations CASCADE");
    // Simulate a database created by the previous release (schema built inside init()).
    await admin.query(migrations[0]!.sql);
    await admin.query(
      `INSERT INTO certificates (id, student_name, student_wallet, title, institution, issued_at, document_hash,
        metadata_uri, status, issuer_email, created_at)
       VALUES ('11111111-1111-4111-8111-111111111111', 'Legacy Student', '0x${"1".repeat(40)}', 'Legacy Title',
        'Legacy Institution', '2026-01-15', '0x${"a".repeat(64)}', 'local-encrypted://legacy.enc', 'active',
        'admin@certichain.local', now())`,
    );
    await admin.end();
    store = new PostgresStore(databaseUrl!);
  });

  afterAll(async () => {
    await store?.close();
  });

  it("adopts an existing schema without losing data and records applied migrations", async () => {
    await Promise.all([store.init(), store.init(), store.healthcheck()]);
    expect(await store.appliedMigrations()).toEqual(migrations.map((migration) => migration.version));
    const legacy = await store.getCertificate("11111111-1111-4111-8111-111111111111");
    expect(legacy).toMatchObject({ studentName: "Legacy Student", issuedAt: "2026-01-15", status: "active" });
    expect(legacy?.chainSyncStatus).toBeUndefined();
  });

  it("round-trips chain sync fields and keeps DATE values unshifted", async () => {
    const record: CertificateRecord = {
      id: "22222222-2222-4222-8222-222222222222",
      studentName: "Sync Student",
      studentWallet: HOLDER_WALLET,
      title: "Sync Title",
      institution: "UNAPEC",
      issuedAt: "2026-03-01",
      documentHash: `0x${"b".repeat(64)}`,
      metadataURI: "local-encrypted://sync.enc",
      status: "pending",
      issuerEmail: "admin@certichain.local",
      createdAt: new Date().toISOString(),
      chainSyncStatus: "submitted",
      chainTxHash: `0x${"c".repeat(64)}`,
      updatedAt: new Date().toISOString(),
    };
    await store.saveCertificate(record);
    expect(await store.getCertificate(record.id)).toMatchObject({
      issuedAt: "2026-03-01",
      chainSyncStatus: "submitted",
      chainTxHash: record.chainTxHash,
    });
  });

  it("rejects an invalid chain sync status at the database level", async () => {
    const client = new pg.Client({ connectionString: databaseUrl });
    await client.connect();
    await expect(
      client.query("UPDATE certificates SET chain_sync_status = 'bogus' WHERE id = '22222222-2222-4222-8222-222222222222'"),
    ).rejects.toThrow(/check constraint/);
    await client.end();
  });

  it("filters, searches literally and paginates server-side", async () => {
    for (const certificate of buildDemoCertificates()) await store.saveCertificate(certificate);

    const page = await store.queryCertificates({ page: 2, pageSize: 5, sort: "issuedAt", direction: "asc" });
    expect(page.total).toBe(26);
    expect(page.items).toHaveLength(5);

    const revoked = await store.queryCertificates({ status: "revoked", page: 1, pageSize: 50 });
    expect(revoked.total).toBe(2);

    const wildcard = await store.queryCertificates({ search: "%", page: 1, pageSize: 50 });
    expect(wildcard.total).toBe(0);

    const byDemoId = await store.queryCertificates({ search: "demo-0005", page: 1, pageSize: 50 });
    expect(byDemoId.total).toBe(1);
  });

  it("bounds and filters audit queries", async () => {
    for (let index = 0; index < 5; index += 1) {
      await store.appendAudit({
        id: `33333333-3333-4333-8333-33333333333${index}`,
        actor: "test",
        action: index % 2 ? "certificate.revoke" : "certificate.issue",
        entityId: "22222222-2222-4222-8222-222222222222",
        timestamp: new Date(Date.UTC(2026, 0, index + 1)).toISOString(),
      });
    }
    expect(await store.listAudit({ limit: 2 })).toHaveLength(2);
    const revokes = await store.listAudit({ actions: ["certificate.revoke"], entityId: "22222222-2222-4222-8222-222222222222" });
    expect(revokes).toHaveLength(2);
    expect(revokes[0]!.timestamp > revokes[1]!.timestamp).toBe(true);
  });

  it("runs the full on-chain issuance and revocation flow through the API", async () => {
    const registry = fakeRegistry();
    const { app } = testApp({ store, registry });
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };

    const issued = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, studentWallet: HOLDER_WALLET });
    expect(issued.status).toBe(201);
    const stored = await store.getCertificate(issued.body.blockchainId);
    expect(stored).toMatchObject({ id: issued.body.id, chainSyncStatus: "anchored", status: "active" });

    const revoked = await request(app).post(`/api/certificates/${issued.body.id}/revoke`).set(auth);
    expect(revoked.status).toBe(200);
    const verify = await request(app).get(`/api/verify/${issued.body.blockchainId}`);
    expect(verify.body.outcome).toBe("revoked");
  });
});
