import request from "supertest";
import { describe, expect, it } from "vitest";
import { buildDemoCertificates } from "./demoData.js";
import { isolatedStore, login, testApp } from "./test/helpers.js";

describe("certificate listing", () => {
  async function demoApp() {
    const store = isolatedStore();
    for (const certificate of buildDemoCertificates()) await store.saveCertificate(certificate);
    const { app } = testApp({ store });
    return { app, auth: { Authorization: `Bearer ${await login(app)}` } };
  }

  it("keeps the legacy unpaginated contract", async () => {
    const { app, auth } = await demoApp();
    const response = await request(app).get("/api/certificates").set(auth);
    expect(response.status).toBe(200);
    expect(response.body.items).toHaveLength(24);
    expect(response.body.total).toBe(24);
    // Demo URIs are not real IPFS objects: never advertised as downloadable.
    expect(response.body.items.every((item: { documentAvailable: boolean }) => item.documentAvailable === false)).toBe(true);
    expect(response.body.items[0].evidenceMode).toBe("demo");
  });

  it("paginates on the server with stable ordering", async () => {
    const { app, auth } = await demoApp();
    const first = await request(app).get("/api/certificates?page=1&pageSize=10&sort=issuedAt&direction=asc").set(auth);
    const third = await request(app).get("/api/certificates?page=3&pageSize=10&sort=issuedAt&direction=asc").set(auth);
    expect(first.body).toMatchObject({ total: 24, page: 1, pageSize: 10, totalPages: 3 });
    expect(first.body.items).toHaveLength(10);
    expect(third.body.items).toHaveLength(4);
    expect(first.body.items[0].issuedAt <= first.body.items[9].issuedAt).toBe(true);
    const ids = new Set([...first.body.items, ...third.body.items].map((item: { id: string }) => item.id));
    expect(ids.size).toBe(14);
  });

  it("searches across student, title, institution and identifiers, accent-insensitive", async () => {
    const { app, auth } = await demoApp();
    const byStudent = await request(app)
      .get(`/api/certificates?search=${encodeURIComponent("sofia ramirez")}`)
      .set(auth);
    expect(byStudent.body.total).toBe(1);
    const byId = await request(app).get("/api/certificates?search=DEMO-0021").set(auth);
    expect(byId.body.total).toBe(1);
    const byStatus = await request(app).get("/api/certificates?status=revoked").set(auth);
    expect(byStatus.body.total).toBe(2);
    const invalid = await request(app).get("/api/certificates?pageSize=1000").set(auth);
    expect(invalid.status).toBe(400);
  });
});
