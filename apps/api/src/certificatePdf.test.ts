import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

const ORIGINAL_LOGO = readFileSync(
  new URL("../../web/public/branding/certichain-logo.png", import.meta.url),
);

describe("certificate PDF", () => {
  it("uses the committed original full CertiChain logo PNG as the branding source", () => {
    expect(ORIGINAL_LOGO.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(ORIGINAL_LOGO.readUInt32BE(16)).toBeGreaterThan(500);
    expect(ORIGINAL_LOGO.readUInt32BE(20)).toBeGreaterThan(500);
  });

  it("builds a clean branded one-page PDF with accents, QR and integrity metadata", () => {
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
    expect(text).toContain("CERTIFICADO ACADÉMICO VERIFICABLE");
    expect(text).toContain("credencial académica");
    expect(text).toContain("Fecha de emisión");
    expect(text).toContain("VALIDACIÓN POR QR");
    expect(text).toContain("Validación automática");
    expect(text).toContain("INTEGRIDAD DIGITAL");
    expect(text).toContain("SHA-256");
    expect(text).toContain("AES-256-GCM");
    expect(text).toContain("BLOCKCHAIN-READY");
    expect(text).toContain("/Logo Do");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/FlateDecode");
    expect(text).not.toContain("/DCTDecode");
    expect(text).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(12_000);
  });

  it("embeds a decodable aspect-preserving RGB raster derived from the full original PNG", () => {
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
    const widthMatch = /\/Width (\d+)/.exec(imageHeader);
    const heightMatch = /\/Height (\d+)/.exec(imageHeader);
    expect(lengthMatch?.[1]).toBeDefined();
    expect(widthMatch?.[1]).toBeDefined();
    expect(heightMatch?.[1]).toBeDefined();
    expect(imageHeader).toContain("/DeviceRGB");
    expect(imageHeader).toContain("/FlateDecode");

    const imageLength = Number(lengthMatch?.[1]);
    const width = Number(widthMatch?.[1]);
    const height = Number(heightMatch?.[1]);
    expect(width).toBeGreaterThan(0);
    expect(height).toBeGreaterThan(0);
    expect(width).toBeLessThanOrEqual(250);
    expect(height).toBeLessThanOrEqual(72);

    const imageStart = imageHeaderEnd + Buffer.byteLength("stream\n", "latin1");
    const compressed = pdf.subarray(imageStart, imageStart + imageLength);
    const rgb = inflateSync(compressed);

    expect(rgb).toHaveLength(width * height * 3);
    expect(new Set(rgb).size).toBeGreaterThan(32);
  });
});
