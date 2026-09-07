import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

function readJpegDimensions(image: Buffer): { width: number; height: number } | null {
  if (image.length < 4 || image[0] !== 0xff || image[1] !== 0xd8) return null;

  let offset = 2;
  while (offset + 4 <= image.length) {
    if (image[offset] !== 0xff) {
      offset += 1;
      continue;
    }

    while (offset < image.length && image[offset] === 0xff) offset += 1;
    if (offset >= image.length) return null;

    const marker = image[offset];
    if (marker === 0xd9 || marker === 0xda) return null;
    if (marker === undefined) return null;

    if ((marker >= 0xd0 && marker <= 0xd7) || marker === 0x01) {
      offset += 1;
      continue;
    }

    if (offset + 2 >= image.length) return null;
    const segmentLength = image.readUInt16BE(offset + 1);
    const markerStart = offset - 1;

    if (marker >= 0xc0 && marker <= 0xc3) {
      if (segmentLength < 8 || markerStart + 9 >= image.length) return null;
      return {
        height: image.readUInt16BE(markerStart + 5),
        width: image.readUInt16BE(markerStart + 7),
      };
    }

    if (segmentLength < 2) return null;
    offset = markerStart + 2 + segmentLength;
  }

  return null;
}

describe("certificate PDF", () => {
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
    expect(pdf.length).toBeGreaterThan(12_000);
  });

  it("embeds a structurally valid JPEG stream for the CertiChain isotipo", () => {
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
    expect(imageHeader).toContain("/Width 180 /Height 180");

    const imageLength = Number(lengthMatch?.[1]);
    const imageStart = imageHeaderEnd + Buffer.byteLength("stream\n", "latin1");
    const image = pdf.subarray(imageStart, imageStart + imageLength);

    expect(image).toHaveLength(imageLength);
    expect(image.subarray(0, 2)).toEqual(Buffer.from([0xff, 0xd8]));
    expect(image.subarray(-2)).toEqual(Buffer.from([0xff, 0xd9]));
    expect(readJpegDimensions(image)).toEqual({ width: 180, height: 180 });
  });
});
