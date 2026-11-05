import { Router } from "express";
import { HttpError, parseOrThrow } from "../http/errors.js";
import { hashSchema, idSchema } from "../http/schemas.js";
import type { ServiceContext } from "../services/context.js";
import { verifyCertificate } from "../services/verificationService.js";

/**
 * Unauthenticated verification endpoints. Responses carry only minimized public data.
 */
export function publicVerificationRoutes(context: ServiceContext): Router {
  const router = Router();

  /**
   * Registered evidence lookup. Kept for legacy clients and for computing a local comparison:
   * a verifier hashes the PDF they hold and compares it to this value. Fetching this hash and
   * sending it back to /verify/:id proves nothing about any file — clients should not do that.
   */
  router.get("/:id/evidence", async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const certificate = await context.store.getCertificate(id);
    if (!certificate) throw new HttpError(404, "not_found", "Certificate not found");

    res.setHeader("Cache-Control", "no-store");
    res.json({
      id: certificate.id,
      blockchainId: certificate.blockchainId,
      documentHash: certificate.documentHash,
      source: "certichain-registry",
    });
  });

  /**
   * GET /api/verify/:id            → registry + blockchain status check, integrity "not_evaluated".
   * GET /api/verify/:id?hash=0x... → additionally compares a verifier-supplied SHA-256.
   */
  router.get("/:id", async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    const parsedHash = req.query.hash === undefined ? undefined : hashSchema.safeParse(req.query.hash);
    if (!parsedId.success || (parsedHash && !parsedHash.success)) {
      throw new HttpError(400, "validation_failed", "A valid certificate id and, if supplied, a SHA-256 hash are required");
    }

    const result = await verifyCertificate(context, parsedId.data, parsedHash?.data);
    res.setHeader("Cache-Control", "no-store");
    if (!result) {
      res.status(404).json({ valid: false, outcome: "not_found", error: "Certificate not found", code: "not_found" });
      return;
    }
    res.json(result);
  });

  return router;
}
