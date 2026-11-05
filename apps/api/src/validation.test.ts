import { mkdir, rm, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import request from "supertest";
import { describe, expect, it } from "vitest";
import { login, testApp, validIssuePayload } from "./test/helpers.js";

describe("input validation and document handling", () => {
  it("rejects invalid wallet checksums, future dates and unknown fields", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };

    const badChecksum = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, studentWallet: "0x8BA1f109551bD432803012645Ac136ddd64DBA72" });
    expect(badChecksum.status).toBe(400);
    expect(badChecksum.body.details.fieldErrors.studentWallet).toBeDefined();

    const zeroAddress = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, studentWallet: "0x0000000000000000000000000000000000000000" });
    expect(zeroAddress.status).toBe(400);

    const future = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, issuedAt: "2999-01-01" });
    expect(future.status).toBe(400);

    const massAssignment = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, status: "active", blockchainId: `0x${"1".repeat(64)}` });
    expect(massAssignment.status).toBe(400);
  });

  it("normalizes whitespace and a lowercase holder wallet", async () => {
    const { app } = testApp();
    const token = await login(app);
    const response = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validIssuePayload, studentName: "  Ana   Pérez  ", studentWallet: "0x8ba1f109551bd432803012645ac136ddd64dba72" });
    expect(response.status).toBe(201);
    expect(response.body.studentName).toBe("Ana Pérez");
    expect(response.body.studentWallet).toBe("0x8ba1f109551bD432803012645Ac136ddd64DBA72");
  });

  it("accepts only real PDF uploads", async () => {
    const { app } = testApp();
    const token = await login(app);

    const disguised = await request(app)
      .post("/api/documents")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/pdf")
      .send(Buffer.from("MZ not really a pdf"));
    expect(disguised.status).toBe(415);

    const octet = await request(app)
      .post("/api/documents")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/octet-stream")
      .send(Buffer.from("%PDF-1.4 binary"));
    expect(octet.status).toBe(415);
  });

  it("rejects oversized and malformed JSON with a uniform error", async () => {
    const { app } = testApp();
    const token = await login(app);
    const huge = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .send({ ...validIssuePayload, title: "x".repeat(40_000) });
    expect(huge.status).toBe(413);
    expect(huge.body.code).toBe("payload_too_large");

    const malformed = await request(app)
      .post("/api/certificates")
      .set("Authorization", `Bearer ${token}`)
      .set("Content-Type", "application/json")
      .send("{not json");
    expect(malformed.status).toBe(400);
    expect(malformed.body.code).toBe("validation_failed");
  });

  it("reports documentAvailable from real storage, not from the URI prefix", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };

    const missing = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, documentHash: `0x${"ab".repeat(32)}`, metadataURI: "local-encrypted://does-not-exist.enc" });
    expect(missing.status).toBe(201);
    expect(missing.body.documentAvailable).toBe(false);

    const download = await request(app).get(`/api/certificates/${missing.body.id}/pdf`).set(auth);
    expect(download.status).toBe(404);
  });

  it("refuses to serve a stored PDF whose ciphertext was tampered with", async () => {
    const { app } = testApp();
    const token = await login(app);
    const auth = { Authorization: `Bearer ${token}` };
    const filename = "tampered-test-document.enc";
    const directory = resolve(process.cwd(), ".data/documents");
    await mkdir(directory, { recursive: true });
    await writeFile(resolve(directory, filename), Buffer.from("CERTICHAIN1-not-a-valid-ciphertext-at-all"));

    const issued = await request(app)
      .post("/api/certificates")
      .set(auth)
      .send({ ...validIssuePayload, documentHash: `0x${"cd".repeat(32)}`, metadataURI: `local-encrypted://${filename}` });
    expect(issued.body.documentAvailable).toBe(true);

    const download = await request(app).get(`/api/certificates/${issued.body.id}/pdf`).set(auth);
    expect(download.status).toBe(502);
    expect(download.body.code).toBe("storage_unavailable");
    expect(JSON.stringify(download.body)).not.toMatch(/decipher|auth tag/i);
    await rm(resolve(directory, filename), { force: true });
  });
});
