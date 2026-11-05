import express, { Router } from "express";
import { authenticate, authorize } from "../http/auth.js";
import { badRequest, HttpError, parseOrThrow } from "../http/errors.js";
import { idSchema, issueSchema, listQuerySchema, revokeSchema } from "../http/schemas.js";
import { storageService } from "../storage.js";
import type { ServiceContext } from "../services/context.js";
import { audit } from "../services/context.js";
import {
  deleteCertificate,
  ensureCertificatePdf,
  issueCertificate,
  readVerifiedPdf,
  reconcileAnchoring,
  revokeCertificate,
  withDocumentAvailability,
} from "../services/certificateService.js";

const PDF_MAGIC = Buffer.from("%PDF-", "latin1");

export function certificateRoutes(context: ServiceContext): Router {
  const router = Router();

  router.post(
    "/documents",
    authenticate,
    authorize("admin", "issuer"),
    express.raw({ type: ["application/pdf"], limit: "10mb" }),
    async (req, res) => {
      if (!req.is("application/pdf")) {
        throw new HttpError(415, "unsupported_media_type", "Only application/pdf documents are accepted");
      }
      if (!Buffer.isBuffer(req.body) || req.body.length === 0) {
        throw badRequest("A PDF certificate document is required");
      }
      // Content sniffing: the declared type must match the actual bytes.
      if (!req.body.subarray(0, PDF_MAGIC.length).equals(PDF_MAGIC)) {
        throw new HttpError(415, "unsupported_media_type", "Uploaded file is not a valid PDF document");
      }

      const filename = req.header("x-file-name") ?? "certificate.pdf";
      const stored = await storageService.saveDocument(req.body, filename, "application/pdf");
      await audit(context, req.user!.email, "document.upload", undefined, {
        documentHash: stored.documentHash,
        metadataURI: stored.metadataURI,
        encryption: stored.encryption,
      });
      res.status(201).json(stored);
    },
  );

  router.get("/certificates", authenticate, async (req, res) => {
    const query = parseOrThrow(listQuerySchema, req.query, "Invalid certificate query");
    const paginated = query.page !== undefined || query.pageSize !== undefined;
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 10_000;
    const result = await context.store.queryCertificates({ ...query, page, pageSize });
    res.json({
      items: await Promise.all(result.items.map(withDocumentAvailability)),
      total: result.total,
      page,
      pageSize: paginated ? pageSize : result.total,
      totalPages: paginated ? Math.max(1, Math.ceil(result.total / pageSize)) : 1,
    });
  });

  router.get("/certificates/:id", authenticate, async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const certificate = await context.store.getCertificate(id);
    if (!certificate) throw new HttpError(404, "not_found", "Certificate not found");
    const history = await context.store.listAudit({ entityId: certificate.id, limit: 50 });
    res.json({ ...(await withDocumentAvailability(certificate)), history });
  });

  router.post("/certificates", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const input = parseOrThrow(issueSchema, req.body, "Invalid certificate payload");
    const { certificate, httpStatus } = await issueCertificate(context, input, req.user!.email);
    res.status(httpStatus).json(await withDocumentAvailability(certificate));
  });

  router.post("/certificates/:id/anchor", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const { certificate, httpStatus } = await reconcileAnchoring(context, id, req.user!.email);
    res.status(httpStatus === 201 ? 200 : 202).json(await withDocumentAvailability(certificate));
  });

  router.post("/certificates/:id/pdf", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const certificate = await ensureCertificatePdf(context, id, req.user!.email);
    res.json(await withDocumentAvailability(certificate));
  });

  router.get("/certificates/:id/pdf", authenticate, async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const { certificate, document } = await readVerifiedPdf(context, id);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="certichain-${certificate.id}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    res.setHeader("X-Content-SHA256", certificate.documentHash);
    res.send(document);
  });

  router.post("/certificates/:id/revoke", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    const body = parseOrThrow(revokeSchema, req.body && Object.keys(req.body).length ? req.body : undefined, "Invalid revocation payload");
    const certificate = await revokeCertificate(context, id, req.user!.email, body?.reason);
    res.json(await withDocumentAvailability(certificate));
  });

  router.delete("/certificates/:id", authenticate, authorize("admin"), async (req, res) => {
    const id = parseOrThrow(idSchema, req.params.id, "Invalid certificate id");
    res.json(await deleteCertificate(context, id, req.user!.email));
  });

  return router;
}
