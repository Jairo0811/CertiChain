import { describe, expect, it } from "vitest";
import { buildCertificatePdf } from "./certificatePdf.js";

describe("certificate PDF", () => {
  it("builds a renderable one-page PDF with Latin credential data", () => {
    const pdf = buildCertificatePdf({
      id: "555e26b1-c13d-494a-a251-53a98707bc4e",
      studentName: "María José Pérez",
      studentWallet: `0x${"11".repeat(20)}`,
      title: "Criptografía Aplicada",
      institution: "Universidad APEC (UNAPEC)",
      issuedAt: "2026-09-06",
    });

    expect(pdf.subarray(0, 8).toString("latin1")).toBe("%PDF-1.4");
    expect(pdf.toString("latin1")).toContain("María José Pérez");
    expect(pdf.toString("latin1")).toContain("Criptografía Aplicada");
    expect(pdf.toString("latin1")).toContain("555e26b1-c13d-494a-a251-53a98707bc4e");
    expect(pdf.toString("latin1")).toContain("%%EOF");
    expect(pdf.length).toBeGreaterThan(2_000);
  });
});
