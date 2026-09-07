import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

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
    expect(text).toContain("CERTICHAIN_VECTOR_ISOTYPE");
    expect(text).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(9_000);
  });

  it("uses vector branding and contains no raster image stream", () => {
    const pdf = buildCertificatePdf({
      id: "555e26b1-c13d-494a-a251-53a98707bc4e",
      studentName: "CertiChain Test Student",
      studentWallet: `0x${"22".repeat(20)}`,
      title: "Blockchain Credential",
      institution: "CertiChain Test Academy",
      issuedAt: "2026-09-06",
    });

    const text = pdf.toString("latin1");
    expect(text).toContain("CERTICHAIN_VECTOR_ISOTYPE");
    expect(text).not.toContain("/Subtype /Image");
    expect(text).not.toContain("/DCTDecode");
    expect(text).not.toContain("/XObject");
  });
});
