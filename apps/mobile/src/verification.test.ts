import { describe, expect, it } from "vitest";
import { parseCredentialReference, statusLabel, verificationVerdict } from "./verification";

describe("mobile verification helpers", () => {
  it("parses the current public verifier QR without requiring a hash", () => {
    expect(
      parseCredentialReference(
        "https://certichain.example/verify?id=555e26b1-c13d-494a-a251-53a98707bc4e&autoverify=1",
      ),
    ).toEqual({ id: "555e26b1-c13d-494a-a251-53a98707bc4e", hash: undefined });
  });

  it("keeps compatibility with legacy deep links that include a hash", () => {
    const hash = `0x${"ab".repeat(32)}`;
    expect(
      parseCredentialReference(
        `certichain://verify?id=DEMO-0021&hash=${encodeURIComponent(hash)}`,
      ),
    ).toEqual({ id: "DEMO-0021", hash });
  });

  it("accepts a raw certificate id", () => {
    expect(parseCredentialReference("  DEMO-0021  ")).toEqual({ id: "DEMO-0021" });
  });

  it("uses user-facing status labels and verdicts", () => {
    expect(statusLabel("active")).toBe("Vigente");
    expect(statusLabel("pending")).toBe("Pendiente");
    expect(statusLabel("revoked")).toBe("Revocada");
    expect(verificationVerdict(true, "active")).toBe("Credencial válida");
    expect(verificationVerdict(false, "pending")).toBe("Credencial pendiente");
    expect(verificationVerdict(false, "revoked")).toBe("Credencial revocada");
  });
});
