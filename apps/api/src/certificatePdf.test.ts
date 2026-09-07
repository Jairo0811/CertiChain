import { readFileSync } from "node:fs";
import { inflateSync } from "node:zlib";
import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

const ORIGINAL_LOGO = readFileSync(
  new URL("../../web/public/branding/certichain-logo.png", import.meta.url),
);

function countOccurrences(value: string, needle: string): number {
  return value.split(needle).length - 1;
}

describe("certificate PDF", () => {
  it("uses the committed original full CertiChain logo PNG as the branding source", () => {
    expect(ORIGINAL_LOGO.subarray(0, 8)).toEqual(
      Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    );
    expect(ORIGINAL_LOGO.readUInt32BE(16)).toBeGreaterThan(500);
    expect(ORIGINAL_LOGO.readUInt32BE(20)).toBeGreaterThan(500);
  });

  it("builds a clean branded one-page PDF without duplicate header metadata", () => {
    const id = "555e26b1-c13d-494a-a251-53a98707bc4e";
    const pdf = buildCertificatePdf({
      id,
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
    expect(text).not.toContain("CREDENCIAL VERIFICABLE");
    expect(text).toContain("Fecha de emisión");
    expect(text).toContain("VALIDACIÓN POR QR");
    expect(text).toContain("Validación automática");
    expect(text).toContain("INTEGRIDAD DIGITAL");
    expect(text).toContain("SHA-256");
    expect(text).toContain("AES-256-GCM");
    expect(text).toContain("BLOCKCHAIN-READY");
    expect(countOccurrences(text, id)).toBe(1);
    expect(countOccurrences(text, "06 SEPTIEMBRE 2026")).toBe(1);
    expect(text).toContain("/Logo Do");
    expect(text).toContain("/Subtype /Image");
    expect(text).toContain("/FlateDecode");
    expect(text).not.toContain("/DCTDecode");
    expect(text).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(20_000);
  });

  it("embeds the full-resolution visible logo raster and scales it only at render time", () => {
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
    expect(width).toBeGreaterThan(500);
    expect(height).toBeGreaterThan(200);

    const imageStart = imageHeaderEnd + Buffer.byteLength("stream\n", "latin1");
    const compressed = pdf.subarray(imageStart, imageStart + imageLength);
    const rgb = inflateSync(compressed);

    expect(rgb).toHaveLength(width * height * 3);
    expect(new Set(rgb).size).toBeGreaterThan(32);
  });
});
