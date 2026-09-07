import { randomUUID } from "node:crypto";
import type { Express, NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { certificateRegistry } from "./blockchain.js";
import { config } from "./config.js";
import type { AuthUser, CertificateStatus } from "./domain.js";
import { store } from "./store.js";

const idSchema = z.string().min(1).max(128);
const statusSchema = z.object({
  status: z.enum(["pending", "active", "revoked"]),
});

function authenticateAdmin(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    const user = jwt.verify(token, config.JWT_SECRET, { issuer: "certichain-api" }) as AuthUser;
    if (user.role !== "admin") {
      res.status(403).json({ error: "Administrator permissions required" });
      return;
    }
    req.user = user;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

export function registerCertificateStatusRoutes(app: Express): void {
  app.post("/api/certificates/:id/status", authenticateAdmin, async (req, res) => {
    try {
      const parsedId = idSchema.safeParse(req.params.id);
      const parsedBody = statusSchema.safeParse(req.body);
      if (!parsedId.success || !parsedBody.success) {
        return res.status(400).json({ error: "A valid certificate id and status are required" });
      }

      const certificate = await store.getCertificate(parsedId.data);
      if (!certificate) return res.status(404).json({ error: "Certificate not found" });

      if (certificate.blockchainId && certificateRegistry.configured) {
        return res.status(409).json({
          error: "This certificate status is controlled by blockchain and cannot be changed manually.",
        });
      }

      const nextStatus = parsedBody.data.status as CertificateStatus;
      const previousStatus = certificate.status;
      if (previousStatus === nextStatus) return res.json(certificate);

      certificate.status = nextStatus;
      certificate.revokedAt = nextStatus === "revoked" ? new Date().toISOString() : undefined;
      await store.saveCertificate(certificate);
      await store.appendAudit({
        id: randomUUID(),
        actor: req.user!.email,
        action: "certificate.status",
        entityId: certificate.id,
        timestamp: new Date().toISOString(),
        metadata: {
          previousStatus,
          nextStatus,
          mode: "off-chain-admin",
        },
      });

      return res.json(certificate);
    } catch (error) {
      console.error(error);
      return res.status(500).json({ error: "Certificate status could not be updated" });
    }
  });
}
