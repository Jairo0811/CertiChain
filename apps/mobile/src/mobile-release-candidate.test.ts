import { describe, expect, it } from "vitest";
import type { Certificate, WalletCredential } from "./types";
import { buildShareMessage, buildVerificationUrl, parseCredentialReference } from "./lib/qr";
import { statusDescription, statusLabel, statusTone } from "./lib/status";
import { upsertWalletCredential, verificationToWalletCredential } from "./lib/wallet";

const activeCertificate: Certificate = {
  id: "cert-001",
  blockchainId: "chain-001",
  studentName: "J. M.",
  title: "Ingeniería de Software",
  institution: "UNAPEC",
  issuedAt: "2026-09-01",
  status: "active",
};

describe("mobile release candidate helpers", () => {
  it("parses modern QR, legacy QR and raw IDs", () => {
    expect(parseCredentialReference("https://verify.example/verify?id=cert-001&autoverify=1")).toEqual({
      id: "cert-001",
      hash: undefined,
    });
    expect(parseCredentialReference("certichain://verify?id=cert-001&hash=0xabc")).toEqual({
      id: "cert-001",
      hash: "0xabc",
    });
    expect(parseCredentialReference(" cert-001 ")).toEqual({ id: "cert-001" });
  });

  it("maps every administrative status explicitly", () => {
    expect(statusLabel("active")).toBe("Vigente");
    expect(statusLabel("pending")).toBe("Pendiente");
    expect(statusLabel("revoked")).toBe("Revocada");
    expect(statusTone("active")).toBe("success");
    expect(statusTone("pending")).toBe("warning");
    expect(statusTone("revoked")).toBe("danger");
    expect(statusDescription("pending")).toContain("todavía no está activa");
  });

  it("builds the current share URL without exposing student data", () => {
    const url = buildVerificationUrl("https://certichain.example/verify", "chain-001");
    expect(url).toBe("https://certichain.example/verify?id=chain-001&autoverify=1");
    const message = buildShareMessage(activeCertificate.title, activeCertificate.institution, url);
    expect(message).toContain("UNAPEC");
    expect(message).not.toContain(activeCertificate.studentName);
  });

  it("deduplicates wallet entries and preserves the original savedAt when revalidating", () => {
    const first = verificationToWalletCredential(activeCertificate, `0x${"a".repeat(64)}`, "2026-09-01T10:00:00Z");
    const pendingUpdate: Certificate = { ...activeCertificate, status: "pending", title: "Título actualizado" };
    const wallet = upsertWalletCredential([first], pendingUpdate, `0x${"b".repeat(64)}`, "2026-09-02T10:00:00Z");
    expect(wallet).toHaveLength(1);
    expect(wallet[0]?.status).toBe("pending");
    expect(wallet[0]?.documentHash).toBe(`0x${"b".repeat(64)}`);
    expect(wallet[0]?.savedAt).toBe("2026-09-01T10:00:00Z");
    expect(wallet[0]?.verifiedAt).toBe("2026-09-02T10:00:00Z");
    expect(wallet[0]?.title).toBe("Título actualizado");
  });

  it("updates an existing wallet credential instead of duplicating the same ID", () => {
    const existing: WalletCredential = {
      ...activeCertificate,
      documentHash: `0x${"a".repeat(64)}`,
      savedAt: "2026-09-01T10:00:00Z",
      verifiedAt: "2026-09-01T10:00:00Z",
    };
    const next = upsertWalletCredential([existing], { ...activeCertificate, status: "revoked" }, `0x${"a".repeat(64)}`, "2026-09-03T10:00:00Z");
    expect(next).toHaveLength(1);
    expect(next[0]?.status).toBe("revoked");
  });
});
