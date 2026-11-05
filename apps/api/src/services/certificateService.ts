import { createHash, randomBytes, randomUUID } from "node:crypto";
import { BlockchainUnavailableError } from "../blockchain.js";
import { buildCertificatePdf } from "../certificatePdf.js";
import {
  evidenceMode,
  isAllowedOffChainTransition,
  requiresReactivationReason,
  statusManagedByBlockchain,
} from "../certificateEvidence.js";
import type { CertificateRecord, CertificateStatus } from "../domain.js";
import { conflict, HttpError, notFound } from "../http/errors.js";
import { storageService } from "../storage.js";
import { audit, type ServiceContext, withCertificateLock } from "./context.js";

export interface IssueInput {
  studentName: string;
  studentWallet?: string;
  title: string;
  institution: string;
  issuedAt: string;
  documentHash?: string;
  metadataURI?: string;
}

export interface IssueOutcome {
  certificate: CertificateRecord;
  /** HTTP status the route should use: 201 created/anchored, 202 accepted while anchoring. */
  httpStatus: 201 | 202;
}

/** A tx unknown to the RPC is only treated as dropped after this grace period. */
const DROPPED_TX_GRACE_MS = 10 * 60_000;

function technicalIdentifier(): string {
  // Random 20-byte identifier used only to bind off-chain PDFs. It has no private key and is NOT a
  // wallet controlled by the student; the UI labels it as a technical identifier.
  return `0x${randomBytes(20).toString("hex")}`;
}

function sanitizeChainError(error: unknown): string {
  if (error instanceof BlockchainUnavailableError) return error.message;
  const message = error instanceof Error ? error.message : String(error);
  // RPC errors may embed URLs with API keys; keep a short, generic description only.
  if (/revert|CALL_EXCEPTION/i.test(message)) return "Transaction reverted by CertificateRegistry";
  if (/insufficient funds/i.test(message)) return "Issuer signer has insufficient funds";
  if (/network|ECONN|ENOTFOUND|timeout|fetch/i.test(message)) return "Blockchain RPC unreachable";
  return "Blockchain transaction failed";
}

export async function withDocumentAvailability(certificate: CertificateRecord) {
  return {
    ...certificate,
    evidenceMode: evidenceMode(certificate),
    statusManagedByBlockchain: statusManagedByBlockchain(certificate),
    documentAvailable: await storageService.documentExists(certificate.metadataURI),
  };
}

async function storeGeneratedPdf(
  context: ServiceContext,
  input: Pick<CertificateRecord, "id" | "studentName" | "studentWallet" | "title" | "institution" | "issuedAt">,
  actor: string,
) {
  const pdf = buildCertificatePdf(input);
  const stored = await storageService.saveDocument(pdf, `certichain-${input.id}.pdf`, "application/pdf");
  await audit(context, actor, "document.upload", input.id, {
    documentHash: stored.documentHash,
    metadataURI: stored.metadataURI,
    encryption: stored.encryption,
    generatedBy: "certichain-pdf",
  });
  return stored;
}

async function save(context: ServiceContext, certificate: CertificateRecord) {
  certificate.updatedAt = new Date().toISOString();
  await context.store.saveCertificate(certificate);
}

/**
 * Issues a credential.
 *
 * Consistency strategy when blockchain is configured ("persist first, then anchor"):
 *   1. The credential is persisted off-chain as `pending` / `submitting` BEFORE any transaction.
 *   2. As soon as the RPC returns a tx hash it is persisted (`submitted`). From this point the
 *      transaction is never re-sent; recovery only looks the receipt up.
 *   3. When the receipt is confirmed the blockchain id is stored and the credential becomes active.
 * A crash or RPC failure at any step leaves a record that `reconcileAnchoring` can finish without
 * creating duplicate on-chain credentials.
 */
export async function issueCertificate(context: ServiceContext, input: IssueInput, actor: string): Promise<IssueOutcome> {
  const { registry } = context;

  if (registry.configured && !input.studentWallet) {
    throw new HttpError(
      400,
      "validation_failed",
      "A holder wallet address is required when blockchain integration is configured",
      { fieldErrors: { studentWallet: ["Required in on-chain mode"] } },
    );
  }

  const id = randomUUID();
  const now = new Date().toISOString();
  const studentWallet = input.studentWallet ?? technicalIdentifier();

  let documentHash = input.documentHash;
  let metadataURI = input.metadataURI;
  if (!documentHash || !metadataURI) {
    const stored = await storeGeneratedPdf(context, { id, ...input, studentWallet }, actor);
    documentHash = stored.documentHash;
    metadataURI = stored.metadataURI;
  }

  const certificate: CertificateRecord = {
    id,
    studentName: input.studentName,
    studentWallet,
    title: input.title,
    institution: input.institution,
    issuedAt: input.issuedAt,
    documentHash,
    metadataURI,
    status: "pending",
    issuerEmail: actor,
    createdAt: now,
    chainSyncStatus: registry.configured ? "submitting" : "not_requested",
  };

  await save(context, certificate);
  await audit(context, actor, "certificate.issue", certificate.id, {
    blockchainConfigured: registry.configured,
    generatedPdf: !input.documentHash,
    holderWalletSupplied: Boolean(input.studentWallet),
  });

  if (!registry.configured) return { certificate, httpStatus: 201 };
  return withCertificateLock(certificate.id, () => submitAnchoring(context, certificate, actor));
}

async function submitAnchoring(context: ServiceContext, certificate: CertificateRecord, actor: string): Promise<IssueOutcome> {
  let submitted;
  try {
    submitted = await context.registry.submitIssue(certificate.studentWallet, certificate.documentHash, certificate.metadataURI);
  } catch (error) {
    certificate.chainSyncStatus = "failed";
    certificate.chainError = sanitizeChainError(error);
    await save(context, certificate);
    await audit(context, actor, "certificate.anchor", certificate.id, {
      result: "submit_failed",
      reason: certificate.chainError,
    });
    return { certificate, httpStatus: 202 };
  }

  certificate.chainSyncStatus = "submitted";
  certificate.chainTxHash = submitted.transactionHash;
  certificate.chainError = undefined;
  await save(context, certificate);

  try {
    const confirmed = await submitted.confirmation;
    await finalizeAnchoring(context, certificate, confirmed.certificateId, actor);
    return { certificate, httpStatus: 201 };
  } catch (error) {
    // Unknown outcome (timeout, RPC drop): keep `submitted` with its tx hash; reconciliation decides.
    certificate.chainError = sanitizeChainError(error);
    await save(context, certificate);
    await audit(context, actor, "certificate.anchor", certificate.id, {
      result: "confirmation_pending",
      transactionHash: certificate.chainTxHash,
    });
    return { certificate, httpStatus: 202 };
  }
}

async function finalizeAnchoring(context: ServiceContext, certificate: CertificateRecord, blockchainId: string, actor: string) {
  certificate.blockchainId = blockchainId;
  certificate.status = "active";
  certificate.chainSyncStatus = "anchored";
  certificate.chainError = undefined;
  await save(context, certificate);
  await audit(context, actor, "certificate.anchor", certificate.id, {
    result: "anchored",
    blockchainId,
    transactionHash: certificate.chainTxHash,
  });
}

/**
 * Idempotent recovery for credentials whose anchoring did not finish. Safe to call repeatedly.
 */
export async function reconcileAnchoring(context: ServiceContext, id: string, actor: string): Promise<IssueOutcome> {
  const existing = await context.store.getCertificate(id);
  if (!existing) throw notFound();

  return withCertificateLock(existing.id, async () => {
    const certificate = (await context.store.getCertificate(existing.id)) ?? existing;
    if (evidenceMode(certificate) === "on-chain" || certificate.chainSyncStatus === "anchored") {
      return { certificate, httpStatus: 201 as const };
    }
    if (!context.registry.configured) {
      throw new HttpError(503, "blockchain_not_configured", "Blockchain integration is not configured in this environment");
    }
    if (certificate.status === "revoked") throw conflict("A revoked credential cannot be anchored");
    if (evidenceMode(certificate) === "demo") throw conflict("Demo credentials are never anchored on-chain");

    const age = Date.now() - Date.parse(certificate.updatedAt ?? certificate.createdAt);

    try {
      if (certificate.chainSyncStatus === "submitted" && certificate.chainTxHash) {
        const lookup = await context.registry.findIssueReceipt(certificate.chainTxHash);
        if (lookup.state === "confirmed") {
          await finalizeAnchoring(context, certificate, lookup.certificateId, actor);
          return { certificate, httpStatus: 201 as const };
        }
        if (lookup.state === "pending" || (lookup.state === "not_found" && age < DROPPED_TX_GRACE_MS)) {
          return { certificate, httpStatus: 202 as const };
        }
        // Reverted or dropped: the transaction never produced a credential, so a retry is safe.
        await audit(context, actor, "certificate.anchor", certificate.id, {
          result: lookup.state,
          transactionHash: certificate.chainTxHash,
        });
        certificate.chainTxHash = undefined;
      } else if (certificate.chainSyncStatus === "submitting") {
        // The tx hash was never persisted (crash between send and save). Look for the event first.
        const recovered = await context.registry.findIssuedByEvidence(certificate.studentWallet, certificate.documentHash);
        if (recovered) {
          await finalizeAnchoring(context, certificate, recovered, actor);
          return { certificate, httpStatus: 201 as const };
        }
        if (age < DROPPED_TX_GRACE_MS) return { certificate, httpStatus: 202 as const };
      }
    } catch (error) {
      if (error instanceof HttpError) throw error;
      throw new HttpError(503, "blockchain_unavailable", "Blockchain RPC is temporarily unavailable. Try again later.");
    }

    // failed / not_requested / dropped → (re)submit exactly once under the lock.
    if (!/^0x[a-fA-F0-9]{40}$/.test(certificate.studentWallet)) {
      throw conflict("Credential has no valid holder wallet for on-chain anchoring");
    }
    certificate.chainSyncStatus = "submitting";
    await save(context, certificate);
    return submitAnchoring(context, certificate, actor);
  });
}

export async function revokeCertificate(context: ServiceContext, id: string, actor: string, reason?: string) {
  const existing = await context.store.getCertificate(id);
  if (!existing) throw notFound();

  return withCertificateLock(existing.id, async () => {
    const certificate = (await context.store.getCertificate(existing.id)) ?? existing;
    if (certificate.status === "revoked") throw conflict("Certificate already revoked");
    if (certificate.chainSyncStatus === "submitting" || certificate.chainSyncStatus === "submitted") {
      throw conflict("Blockchain anchoring is still in progress. Reconcile it before revoking.");
    }

    const mode = evidenceMode(certificate);
    if (mode === "on-chain") {
      if (!context.registry.configured) {
        throw new HttpError(
          503,
          "blockchain_not_configured",
          "This credential is anchored on-chain; revocation requires the blockchain integration to be configured.",
        );
      }
      try {
        const current = await context.registry.verify(certificate.blockchainId!, certificate.documentHash);
        // Already revoked on-chain (e.g. previous attempt confirmed but DB update failed): only sync.
        if (!current.exists || current.active) {
          certificate.chainRevokeTxHash = await context.registry.revoke(certificate.blockchainId!);
        }
      } catch (error) {
        throw new HttpError(503, "blockchain_unavailable", `On-chain revocation failed: ${sanitizeChainError(error)}`);
      }
    }

    certificate.status = "revoked";
    certificate.revokedAt = new Date().toISOString();
    await save(context, certificate);
    await audit(context, actor, "certificate.revoke", certificate.id, {
      evidenceMode: mode,
      transactionHash: certificate.chainRevokeTxHash,
      ...(reason ? { reason } : {}),
    });
    return certificate;
  });
}

export async function deleteCertificate(context: ServiceContext, id: string, actor: string) {
  const existing = await context.store.getCertificate(id);
  if (!existing) throw notFound();

  return withCertificateLock(existing.id, async () => {
    const certificate = (await context.store.getCertificate(existing.id)) ?? existing;
    if (statusManagedByBlockchain(certificate)) {
      throw conflict("A blockchain-bound certificate cannot be deleted. Revoke it to preserve the audit trail.");
    }

    const evidenceDeleted = await storageService.deleteDocument(certificate.metadataURI);
    const deleted = await context.store.deleteCertificate(certificate.id);
    if (!deleted) throw notFound();

    await audit(context, actor, "certificate.delete", certificate.id, {
      previousStatus: certificate.status,
      blockchainId: certificate.blockchainId,
      evidenceMode: evidenceMode(certificate),
      evidenceDeleted,
      cleanupScope: "off-chain-admin-cleanup",
    });
    return { deleted: true as const, id: certificate.id, evidenceDeleted };
  });
}

export async function changeOffChainStatus(
  context: ServiceContext,
  id: string,
  nextStatus: CertificateStatus,
  actor: string,
  reason?: string,
) {
  const existing = await context.store.getCertificate(id);
  if (!existing) throw notFound();

  return withCertificateLock(existing.id, async () => {
    const certificate = (await context.store.getCertificate(existing.id)) ?? existing;
    if (statusManagedByBlockchain(certificate)) {
      throw conflict("This certificate status is controlled by blockchain and cannot be changed manually.");
    }

    const previousStatus = certificate.status;
    if (previousStatus === nextStatus) return certificate;
    if (!isAllowedOffChainTransition(previousStatus, nextStatus)) {
      throw conflict(`Transition ${previousStatus} → ${nextStatus} is not allowed`);
    }
    if (requiresReactivationReason(previousStatus, nextStatus) && !reason) {
      throw new HttpError(400, "validation_failed", "A reason is required to reactivate a revoked off-chain credential", {
        fieldErrors: { reason: ["Required when leaving the revoked state"] },
      });
    }

    certificate.status = nextStatus;
    certificate.revokedAt = nextStatus === "revoked" ? new Date().toISOString() : undefined;
    await save(context, certificate);
    await audit(context, actor, "certificate.status", certificate.id, {
      previousStatus,
      nextStatus,
      mode: "off-chain-admin",
      evidenceMode: evidenceMode(certificate),
      ...(reason ? { reason } : {}),
    });
    return certificate;
  });
}

/** Regenerates the PDF only for off-chain pending records without evidence on disk. */
export async function ensureCertificatePdf(context: ServiceContext, id: string, actor: string) {
  const existing = await context.store.getCertificate(id);
  if (!existing) throw notFound();

  return withCertificateLock(existing.id, async () => {
    const certificate = (await context.store.getCertificate(existing.id)) ?? existing;
    if (await storageService.documentExists(certificate.metadataURI)) return certificate;
    if (certificate.status !== "pending" || statusManagedByBlockchain(certificate) || certificate.blockchainId) {
      throw conflict("Stored evidence cannot be replaced for an active or blockchain-bound certificate");
    }

    const stored = await storeGeneratedPdf(context, certificate, actor);
    certificate.documentHash = stored.documentHash;
    certificate.metadataURI = stored.metadataURI;
    await save(context, certificate);
    return certificate;
  });
}

/** Reads, decrypts and integrity-checks the PDF before it is served. */
export async function readVerifiedPdf(context: ServiceContext, id: string) {
  const certificate = await context.store.getCertificate(id);
  if (!certificate) throw notFound();
  if (!(await storageService.documentExists(certificate.metadataURI))) {
    throw new HttpError(404, "not_found", "Certificate PDF is not available in this environment");
  }

  let document: Buffer;
  try {
    document = await storageService.readDocument(certificate.metadataURI);
  } catch {
    // Missing object, wrong key (GCM auth failure) or IPFS error: never expose the cause.
    throw new HttpError(502, "storage_unavailable", "Certificate PDF could not be retrieved or decrypted");
  }

  const documentHash = `0x${createHash("sha256").update(document).digest("hex")}`;
  if (documentHash.toLowerCase() !== certificate.documentHash.toLowerCase()) {
    throw new HttpError(409, "integrity_failure", "Stored certificate PDF failed its SHA-256 integrity check");
  }
  return { certificate, document };
}
