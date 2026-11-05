import request from "supertest";
import { describe, expect, it } from "vitest";
import type { CertificateRecord } from "./domain.js";
import { buildDashboard } from "./services/dashboardService.js";
import { fakeRegistry, isolatedStore, login, testApp, validIssuePayload } from "./test/helpers.js";

function record(id: string, issuedAt: string, status: CertificateRecord["status"], institution = "UNAPEC", revokedAt?: string): CertificateRecord {
  return {
    id,
    studentName: `Student ${id}`,
    studentWallet: `0x${"1".repeat(40)}`,
    title: `Title ${id}`,
    institution,
    issuedAt,
    documentHash: `0x${"a".repeat(64)}`,
    metadataURI: "local-encrypted://x.enc",
    status,
    issuerEmail: "admin@certichain.local",
    createdAt: `${issuedAt}T12:00:00.000Z`,
    revokedAt,
  };
}

describe("dashboard aggregation", () => {
  const now = new Date("2026-11-05T15:00:00Z");

  async function seeded() {
    const store = isolatedStore();
    await store.saveCertificate(record("a", "2026-11-01", "active", "UNAPEC"));
    await store.saveCertificate(record("b", "2026-10-20", "pending", "ITLA"));
    await store.saveCertificate(record("c", "2026-09-15", "revoked", "UNAPEC", "2026-11-02T10:00:00.000Z"));
    await store.saveCertificate(record("d", "2026-08-10", "active", "PUCMM"));
    await store.saveCertificate(record("e", "2025-12-01", "active", "PUCMM"));
    return { store, registry: fakeRegistry({ configured: false }) };
  }

  it("filters cards, series and institutions by issuance date consistently", async () => {
    const context = await seeded();
    const last30 = await buildDashboard(context, "30", now);
    expect(last30.range).toMatchObject({ from: "2026-10-07", to: "2026-11-05", dateBasis: "issuedAt", granularity: "day" });
    expect(last30.period).toMatchObject({ issued: 2, active: 1, pending: 1, revoked: 0, institutions: 2 });
    expect(last30.series).toHaveLength(30);
    expect(last30.series.reduce((sum, bucket) => sum + bucket.issued, 0)).toBe(2);
    expect(last30.byInstitution.map((item) => item.institution).sort()).toEqual(["ITLA", "UNAPEC"]);
    // Revocation dates are counted by their own timestamp, not by the issuance date.
    expect(last30.period.revocationsInRange).toBe(1);

    const last90 = await buildDashboard(context, "90", now);
    expect(last90.range.from).toBe("2026-08-08");
    expect(last90.period.issued).toBe(4);
    expect(last90.range.granularity).toBe("week");
    expect(last90.series.reduce((sum, bucket) => sum + bucket.issued, 0)).toBe(4);

    const year = await buildDashboard(context, "365", now);
    expect(year.period.issued).toBe(5);
    expect(year.series).toHaveLength(12);

    const all = await buildDashboard(context, "all", now);
    expect(all.allTime).toMatchObject({ total: 5, active: 3, pending: 1, revoked: 1, institutions: 3 });
    expect(all.trend).toBeNull();
  });

  it("only reports a trend when the previous period has data", async () => {
    const context = await seeded();
    // Previous 365 days (2024-11-06 → 2025-11-05) have no credentials: no invented comparison.
    expect((await buildDashboard(context, "365", now)).trend).toBeNull();

    // Previous 30 days (2026-09-07 → 2026-10-06) contain one credential; current period has two.
    const last30 = await buildDashboard(context, "30", now);
    expect(last30.trend).toEqual({ previousIssued: 1, changePercent: 100 });
  });

  it("serves activity from real audit events through the API", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const { body } = await request(app).post("/api/certificates").set(auth).send({ ...validIssuePayload, issuedAt: new Date().toISOString().slice(0, 10) });
    await request(app).post(`/api/certificates/${body.id}/revoke`).set(auth);

    const dashboard = await request(app).get("/api/dashboard?range=30").set(auth);
    expect(dashboard.status).toBe(200);
    expect(dashboard.body.activity.map((item: { action: string }) => item.action)).toEqual(
      expect.arrayContaining(["certificate.issue", "certificate.revoke"]),
    );
    const revocation = dashboard.body.activity.find((item: { action: string }) => item.action === "certificate.revoke");
    expect(revocation.title).toBe(validIssuePayload.title);

    expect((await request(app).get("/api/dashboard?range=7").set(auth)).status).toBe(400);
  });
});
