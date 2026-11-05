import { Router, type Express } from "express";
import { certificateRegistry } from "./blockchain.js";
import { authenticate, authorize } from "./http/auth.js";
import { parseOrThrow } from "./http/errors.js";
import { idSchema, statusChangeSchema } from "./http/schemas.js";
import type { ServiceContext } from "./services/context.js";
import { changeOffChainStatus, withDocumentAvailability } from "./services/certificateService.js";
import { store } from "./store.js";

/**
 * Manual status management for off-chain and demo credentials (administrators only).
 *
 * Rules (see certificateEvidence.ts):
 * - Credentials anchored on-chain, or with anchoring in flight, are governed by the contract: 409.
 * - Allowed transitions are audited with previous/next status, actor and evidence mode.
 * - Leaving the revoked state requires a written reason and is never possible for on-chain records.
 */
export function certificateStatusRouter(context: ServiceContext): Router {
  const router = Router();
  router.post("/certificates/:id/status", authenticate, authorize("admin"), async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "A valid certificate id is required");
    const body = parseOrThrow(statusChangeSchema, req.body, "A valid certificate status is required");
    const certificate = await changeOffChainStatus(context, id, body.status, req.user!.email, body.reason);
    res.json(await withDocumentAvailability(certificate));
  });
  return router;
}

const MOUNTED = Symbol.for("certichain.statusRoutesMounted");

/**
 * Backwards-compatible entry point. `createApp()` now mounts these routes itself (previously only
 * `server.ts` did, so tests and production composed different apps). Calling this on an app that
 * already has them is a no-op.
 */
export function registerCertificateStatusRoutes(app: Express, context?: ServiceContext): void {
  const flagged = app as Express & { [MOUNTED]?: boolean };
  if (flagged[MOUNTED]) return;
  flagged[MOUNTED] = true;
  app.use("/api", certificateStatusRouter(context ?? { store, registry: certificateRegistry }));
}

export function markStatusRoutesMounted(app: Express): void {
  (app as Express & { [MOUNTED]?: boolean })[MOUNTED] = true;
}
