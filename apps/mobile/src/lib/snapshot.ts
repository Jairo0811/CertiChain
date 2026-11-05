import type { BlockchainCheck, Verification, VerificationOutcome, VerificationSnapshot } from "../types";

/** Derives an explicit outcome even from older APIs that only returned `valid` and booleans. */
export function outcomeOf(verification: Verification): VerificationOutcome {
  if (verification.outcome) return verification.outcome;
  const status = verification.certificate?.status;
  if (verification.checks?.hashMatches === false) return "integrity_mismatch";
  if (status === "revoked") return "revoked";
  if (status === "pending") return "pending";
  return verification.valid ? "valid" : "blockchain_mismatch";
}

export function snapshotFromVerification(
  verification: Verification,
  verifiedAt: string,
  hashSource: "link" | "none",
): VerificationSnapshot | undefined {
  if (!verification.certificate) return undefined;
  return {
    verifiedAt: verification.verifiedAt ?? verifiedAt,
    valid: verification.valid,
    outcome: outcomeOf(verification),
    status: verification.certificate.status,
    evidenceMode: verification.evidenceMode ?? verification.certificate.evidenceMode,
    integrity:
      verification.checks?.integrity ??
      (hashSource === "link" ? (verification.checks?.hashMatches ? "match" : "mismatch") : "not_evaluated"),
    hashSource,
    blockchainStatus: verification.checks?.blockchainStatus ?? legacyBlockchainStatus(verification),
  };
}

function legacyBlockchainStatus(verification: Verification): BlockchainCheck | undefined {
  const chain = verification.checks?.blockchain;
  if (!chain) return undefined;
  if (!chain.exists) return "not_found_on_chain";
  if (chain.hashMatches === false) return "hash_mismatch";
  if (chain.active === false) return "revoked_on_chain";
  return "verified";
}

export type CheckTone = "ok" | "fail" | "warn" | "skip";

export interface CheckRow {
  label: string;
  value: string;
  tone: CheckTone;
}

const BLOCKCHAIN_ROW: Record<BlockchainCheck, { value: string; tone: CheckTone }> = {
  verified: { value: "Ancla confirmada y vigente", tone: "ok" },
  hash_mismatch: { value: "El hash anclado no coincide", tone: "fail" },
  revoked_on_chain: { value: "Revocada en el contrato", tone: "fail" },
  not_found_on_chain: { value: "No existe en el contrato", tone: "fail" },
  not_configured: { value: "No configurada en el servidor", tone: "warn" },
  unavailable: { value: "Red inaccesible en ese momento", tone: "warn" },
  not_anchored: { value: "Credencial off-chain, sin ancla", tone: "skip" },
  demo: { value: "Credencial demo, sin ancla", tone: "skip" },
};

/**
 * Check rows for a result. Integrity is only "Coincide" when a hash was actually compared (legacy
 * links carry one); identifier lookups never claim document integrity.
 */
export function checkRows(
  snapshot: Pick<VerificationSnapshot, "status" | "integrity" | "hashSource" | "blockchainStatus">,
): CheckRow[] {
  const registry: CheckRow = {
    label: "Registro CertiChain",
    value: snapshot.status === "active" ? "Vigente" : snapshot.status === "pending" ? "Pendiente" : "Revocada",
    tone: snapshot.status === "active" ? "ok" : snapshot.status === "pending" ? "warn" : "fail",
  };
  const integrity: CheckRow =
    snapshot.integrity === "not_evaluated"
      ? { label: "Integridad del documento", value: "No evaluada: no se presentó ningún PDF", tone: "skip" }
      : snapshot.integrity === "match"
        ? {
            label: "SHA-256 del enlace",
            value: "Coincide con el registrado",
            tone: snapshot.hashSource === "link" ? "warn" : "ok",
          }
        : { label: "SHA-256 del enlace", value: "No coincide con el registrado", tone: "fail" };
  const chain = snapshot.blockchainStatus
    ? BLOCKCHAIN_ROW[snapshot.blockchainStatus]
    : { value: "Sin información", tone: "skip" as const };
  return [registry, integrity, { label: "Blockchain", ...chain }];
}

export function outcomeTitle(outcome: VerificationOutcome): string {
  switch (outcome) {
    case "valid":
      return "Credencial vigente";
    case "pending":
      return "Credencial pendiente";
    case "revoked":
      return "Credencial revocada";
    case "not_found":
      return "Credencial no encontrada";
    case "integrity_mismatch":
      return "El SHA-256 no coincide";
    case "blockchain_mismatch":
      return "Discrepancia con la blockchain";
    case "blockchain_not_configured":
      return "Blockchain no disponible en el servidor";
    case "blockchain_unavailable":
      return "Blockchain temporalmente inaccesible";
  }
}

export function outcomeTone(outcome: VerificationOutcome): "success" | "warning" | "danger" {
  if (outcome === "valid") return "success";
  if (outcome === "pending" || outcome === "blockchain_not_configured" || outcome === "blockchain_unavailable") return "warning";
  return "danger";
}
