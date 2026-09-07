import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

const BRAND_ASSET = readFileSync(new URL("../assets/branding/certichain-isotipo-header.jpg", import.meta.url));

describe("certificate PDF", () => {
  it("keeps the committed CertiChain JPEG asset intact", () => {
    expect(BRAND_ASSET).toHaveLength(8593);
    expect(BRAND_ASSET.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(BRAND_ASSET.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });

  it("builds a branded one-page PDF with verification QR and trust-layer metadata", () => {
    const pdf = buildCertificatePdf({
      id: "555e26b1-c13d-494a-a251-53a98707bc4e",
      studentName: "María José Pérez",
      studentWallet: `0x${"11".repeat(20)}`,
      title: "Criptografía Aplicada",
      institution: "Universidad APEC (UNAPEC)",
      issuedAt: "2026-09-06",
    });

    const text = pdf.toString("latin1");
    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(text).toContain("María José Pérez");
    expect(text).toContain("Criptografía Aplicada");
    expect(text).toContain("555e26b1-c13d-494a-a251-53a98707bc4e");
    expect(text).toContain("CERTIFICADO ACADEMICO VERIFICABLE");
    expect(text).toContain("TRUST LAYER");
    expect(text).toContain("SHA-256");
    expect(text).toContain("AES-256-GCM");
    expect(text).toContain("BLOCKCHAIN READY");
    expect(text).toContain("/Logo Do");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(17_000);
  });

  it("embeds the exact committed JPEG stream for the CertiChain isotipo", () => {
    const pdf = buildCertificatePdf({
      id: "555e26b1-c13d-494a-a251-53a98707bc4e",
      studentName: "CertiChain Test Student",
      studentWallet: `0x${"22".repeat(20)}`,
      title: "Blockchain Credential",
      institution: "CertiChain Test Academy",
      issuedAt: "2026-09-06",
    });

    const imageObjectStart = pdf.indexOf(Buffer.from("/Subtype /Image", "latin1"));
    expect(imageObjectStart).toBeGreaterThanOrEqual(0);

    const imageHeaderEnd = pdf.indexOf(Buffer.from("stream\n", "latin1"), imageObjectStart);
    expect(imageHeaderEnd).toBeGreaterThan(imageObjectStart);

    const imageHeader = pdf.subarray(imageObjectStart, imageHeaderEnd).toString("latin1");
    const lengthMatch = /\/Length (\d+)/.exec(imageHeader);
    expect(lengthMatch?.[1]).toBeDefined();

    const imageLength = Number(lengthMatch?.[1]);
    const imageStart = imageHeaderEnd + Buffer.byteLength("stream\n", "latin1");
    const image = pdf.subarray(imageStart, imageStart + imageLength);

    expect(imageLength).toBe(BRAND_ASSET.length);
    expect(image).toEqual(BRAND_ASSET);
    expect(image.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(image.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
  });
});
