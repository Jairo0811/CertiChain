import { describe, expect, it } from "vitest";
import { buildDemoCertificates, demoVerificationSample } from "./demoData.js";

describe("portfolio demo dataset", () => {
  it("builds a deterministic 24-certificate academic showcase", () => {
    const certificates = buildDemoCertificates();

    expect(certificates).toHaveLength(24);
    expect(certificates.filter((item) => item.status === "active")).toHaveLength(21);
    expect(certificates.filter((item) => item.status === "revoked")).toHaveLength(2);
    expect(certificates.filter((item) => item.status === "pending")).toHaveLength(1);
    expect(new Set(certificates.map((item) => item.institution))).toHaveSize(3);
    expect(new Set(certificates.map((item) => item.id))).toHaveSize(24);
    expect(new Set(certificates.map((item) => item.documentHash))).toHaveSize(24);
  });

  it("keeps all showcase identities explicitly marked as demo data", () => {
    const certificates = buildDemoCertificates();
    expect(certificates.every((item) => item.studentName.endsWith("· Demo"))).toBe(true);
    expect(certificates.every((item) => item.issuerEmail === "portfolio-demo@certichain.local")).toBe(true);
  });

  it("publishes a stable valid-verification sample", () => {
    expect(demoVerificationSample.id).toBe("DEMO-0001");
    expect(demoVerificationSample.hash).toMatch(/^0x[a-f0-9]{64}$/);
  });
});
