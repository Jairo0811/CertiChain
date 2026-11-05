import type { BlockchainVerificationResult } from "../blockchain.js";
import { evidenceMode, statusManagedByBlockchain } from "../certificateEvidence.js";
import type { CertificateStatus, EvidenceMode } from "../domain.js";
import { maskPersonName } from "../security.js";
import { audit, type ServiceContext } from "./context.js";

/**
 * Explicit verification outcome. Clients must branch on this instead of the legacy `valid` flag.
 */
export type VerificationOutcome =
  | "valid"
  | "pending"
  | "revoked"
  | "not_found"
  | "integrity_mismatch"
  | "blockchain_mismatch"
  | "blockchain_not_configured"
  | "blockchain_unavailable";

/**
 * What was compared:
 * - match / mismatch: a hash supplied by the verifier (computed from a PDF they hold, or carried by
 *   a legacy link) was compared against the registered SHA-256.
 * - not_evaluated: lookup by identifier only. No document was presented, so no claim is made about
 *   the integrity of any file.
 */
export type IntegrityCheck = "match" | "mismatch" | "not_evaluated";

export type BlockchainCheck =
  | "verified"
  | "hash_mismatch"
  | "revoked_on_chain"
  | "not_found_on_chain"
  | "not_configured"
  | "unavailable"
  | "not_anchored"
  | "demo";

export interface VerificationResponse {
  valid: boolean;
  outcome: VerificationOutcome;
  evidenceMode: EvidenceMode;
  verifiedAt: string;
  certificate: {
    id: string;
    blockchainId?: string;
    studentName: string;
    title: string;
    institution: string;
    issuedAt: string;
    status: CertificateStatus;
    revokedAt?: string;
    evidenceMode: EvidenceMode;
  };
  checks: {
    existsOffChain: true;
    registryStatus: CertificateStatus;
    integrity: IntegrityCheck;
    hashSource: "verifier" | "none";
    /** Legacy boolean kept for older clients; null when no hash was presented. */
    hashMatches: boolean | null;
    blockchainStatus: BlockchainCheck;
    /** Raw contract view, only when the contract was actually consulted. */
    blockchain: BlockchainVerificationResult | null;
    statusManagedByBlockchain: boolean;
  };
}

export async function verifyCertificate(
  context: ServiceContext,
  id: string,
  suppliedHash: string | undefined,
): Promise<VerificationResponse | null> {
  const certificate = await context.store.getCertificate(id);
  if (!certificate) return null;

  const mode = evidenceMode(certificate);
  const integrity: IntegrityCheck = suppliedHash
    ? certificate.documentHash.toLowerCase() === suppliedHash.toLowerCase()
      ? "match"
      : "mismatch"
    : "not_evaluated";

  let blockchain: BlockchainVerificationResult | null = null;
  let blockchainStatus: BlockchainCheck;

  if (mode === "demo") {
    blockchainStatus = "demo";
  } else if (mode === "off-chain") {
    blockchainStatus = "not_anchored";
  } else if (!context.registry.configured) {
    blockchainStatus = "not_configured";
  } else {
    try {
      // Without a presented document, check that the registry's hash is the one anchored on-chain.
      blockchain = await context.registry.verify(certificate.blockchainId!, suppliedHash ?? certificate.documentHash);
      if (!blockchain.exists) blockchainStatus = "not_found_on_chain";
      else if (!blockchain.hashMatches) blockchainStatus = "hash_mismatch";
      else if (!blockchain.active) blockchainStatus = "revoked_on_chain";
      else blockchainStatus = "verified";
    } catch {
      blockchainStatus = "unavailable";
    }
  }

  let outcome: VerificationOutcome;
  if (integrity === "mismatch") outcome = "integrity_mismatch";
  else if (blockchainStatus === "revoked_on_chain" || certificate.status === "revoked") outcome = "revoked";
  else if (blockchainStatus === "not_found_on_chain" || blockchainStatus === "hash_mismatch") outcome = "blockchain_mismatch";
  else if (blockchainStatus === "unavailable") outcome = "blockchain_unavailable";
  else if (blockchainStatus === "not_configured") outcome = "blockchain_not_configured";
  else if (certificate.status === "pending") outcome = "pending";
  else outcome = "valid";

  const response: VerificationResponse = {
    valid: outcome === "valid",
    outcome,
    evidenceMode: mode,
    verifiedAt: new Date().toISOString(),
    certificate: {
      id: certificate.id,
      blockchainId: certificate.blockchainId,
      studentName: maskPersonName(certificate.studentName),
      title: certificate.title,
      institution: certificate.institution,
      issuedAt: certificate.issuedAt,
      status: certificate.status,
      revokedAt: certificate.revokedAt,
      evidenceMode: mode,
    },
    checks: {
      existsOffChain: true,
      registryStatus: certificate.status,
      integrity,
      hashSource: suppliedHash ? "verifier" : "none",
      hashMatches: integrity === "not_evaluated" ? null : integrity === "match",
      blockchainStatus,
      blockchain,
      statusManagedByBlockchain: statusManagedByBlockchain(certificate),
    },
  };

  // Verification must never fail because the audit trail could not be written.
  await audit(context, "public-verifier", "certificate.verify", certificate.id, {
    outcome,
    integrity,
    blockchainStatus,
  }).catch(() => undefined);

  return response;
}
