import type { CertificateRecord, CertificateStatus, EvidenceMode } from "./domain.js";

const ON_CHAIN_ID = /^0x[a-fA-F0-9]{64}$/;

/** True only for identifiers produced by CertificateRegistry (bytes32). */
export function isOnChainId(value: string | undefined): value is string {
  return Boolean(value && ON_CHAIN_ID.test(value));
}

export function isDemoCertificate(certificate: Pick<CertificateRecord, "blockchainId" | "issuerEmail">): boolean {
  return (
    certificate.issuerEmail === "portfolio-demo@certichain.local" ||
    Boolean(certificate.blockchainId?.toUpperCase().startsWith("DEMO-"))
  );
}

export function evidenceMode(certificate: Pick<CertificateRecord, "blockchainId" | "issuerEmail">): EvidenceMode {
  if (isOnChainId(certificate.blockchainId)) return "on-chain";
  if (isDemoCertificate(certificate)) return "demo";
  return "off-chain";
}

/**
 * Status of an anchored credential is governed by the smart contract, regardless of whether the
 * RPC is configured in the current environment. It can only move forward through on-chain
 * revocation; manual edits and reactivation are forbidden.
 */
export function statusManagedByBlockchain(
  certificate: Pick<CertificateRecord, "blockchainId" | "chainSyncStatus" | "issuerEmail">,
): boolean {
  return (
    evidenceMode(certificate) === "on-chain" ||
    certificate.chainSyncStatus === "submitting" ||
    certificate.chainSyncStatus === "submitted"
  );
}

/**
 * Valid manual transitions for off-chain and demo credentials. Every transition is audited.
 * Reactivating a revoked credential is allowed only for off-chain/demo records and requires a
 * written reason (see certificateStatusRoutes).
 */
const OFF_CHAIN_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
  pending: ["active", "revoked"],
  active: ["pending", "revoked"],
  revoked: ["active", "pending"],
};

export function isAllowedOffChainTransition(from: CertificateStatus, to: CertificateStatus): boolean {
  return OFF_CHAIN_TRANSITIONS[from].includes(to);
}

export function requiresReactivationReason(from: CertificateStatus, to: CertificateStatus): boolean {
  return from === "revoked" && to !== "revoked";
}
