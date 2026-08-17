import { randomUUID } from "node:crypto";
import cors from "cors";
import express, { NextFunction, Request, Response } from "express";
import helmet from "helmet";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { certificateRegistry } from "./blockchain.js";
import { config } from "./config.js";
import { AuthUser, CertificateRecord } from "./domain.js";
import { store } from "./store.js";

declare global {
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/);
const idSchema = z.string().min(1).max(128);

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
});

const issueSchema = z.object({
  studentName: z.string().min(2).max(160),
  studentWallet: z.string().regex(/^0x[a-fA-F0-9]{40}$/),
  title: z.string().min(2).max(200),
  institution: z.string().min(2).max(200),
  issuedAt: z.string().date(),
  documentHash: hashSchema,
  metadataURI: z.string().min(1).max(500),
});

function createToken(user: AuthUser): string {
  return jwt.sign(user, config.JWT_SECRET, { expiresIn: "8h", issuer: "certichain-api" });
}

function authenticate(req: Request, res: Response, next: NextFunction): void {
  const token = req.headers.authorization?.replace(/^Bearer\s+/i, "");
  if (!token) {
    res.status(401).json({ error: "Authentication required" });
    return;
  }

  try {
    req.user = jwt.verify(token, config.JWT_SECRET, { issuer: "certichain-api" }) as AuthUser;
    next();
  } catch {
    res.status(401).json({ error: "Invalid or expired token" });
  }
}

function authorize(...roles: AuthUser["role"][]) {
  return (req: Request, res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      res.status(403).json({ error: "Insufficient permissions" });
      return;
    }
    next();
  };
}

async function audit(actor: string, action: Parameters<typeof store.appendAudit>[0]["action"], entityId?: string, metadata?: Record<string, unknown>) {
  await store.appendAudit({
    id: randomUUID(),
    actor,
    action,
    entityId,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

export function createApp() {
  const app = express();
  app.disable("x-powered-by");
  app.use(helmet());
  app.use(cors({ origin: config.CORS_ORIGIN }));
  app.use(express.json({ limit: "256kb" }));

  app.get("/health", (_req, res) => {
    res.json({ status: "ok", blockchainConfigured: certificateRegistry.configured });
  });

  app.post("/api/auth/login", async (req, res) => {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid credentials payload" });

    if (parsed.data.email !== config.ADMIN_EMAIL || parsed.data.password !== config.ADMIN_PASSWORD) {
      return res.status(401).json({ error: "Invalid credentials" });
    }

    const user: AuthUser = { id: "local-admin", email: config.ADMIN_EMAIL, role: "admin" };
    await audit(user.email, "login");
    return res.json({ token: createToken(user), user });
  });

  app.get("/api/certificates", authenticate, async (_req, res) => {
    res.json({ items: await store.listCertificates() });
  });

  app.post("/api/certificates", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const parsed = issueSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "Invalid certificate payload", details: parsed.error.flatten() });

    const now = new Date().toISOString();
    const certificate: CertificateRecord = {
      id: randomUUID(),
      ...parsed.data,
      status: "pending",
      issuerEmail: req.user!.email,
      createdAt: now,
    };

    if (certificateRegistry.configured) {
      const result = await certificateRegistry.issue(
        certificate.studentWallet,
        certificate.documentHash,
        certificate.metadataURI,
      );
      certificate.blockchainId = result.certificateId;
      certificate.status = "active";
    }

    await store.saveCertificate(certificate);
    await audit(req.user!.email, "certificate.issue", certificate.id, {
      blockchainId: certificate.blockchainId,
      blockchainConfigured: certificateRegistry.configured,
    });

    return res.status(201).json(certificate);
  });

  app.post("/api/certificates/:id/revoke", authenticate, authorize("admin", "issuer"), async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    if (!parsedId.success) return res.status(400).json({ error: "Invalid certificate id" });

    const certificate = await store.getCertificate(parsedId.data);
    if (!certificate) return res.status(404).json({ error: "Certificate not found" });
    if (certificate.status === "revoked") return res.status(409).json({ error: "Certificate already revoked" });

    if (certificate.blockchainId && certificateRegistry.configured) {
      await certificateRegistry.revoke(certificate.blockchainId);
    }

    certificate.status = "revoked";
    certificate.revokedAt = new Date().toISOString();
    await store.saveCertificate(certificate);
    await audit(req.user!.email, "certificate.revoke", certificate.id);

    return res.json(certificate);
  });

  app.get("/api/verify/:id", async (req, res) => {
    const parsedId = idSchema.safeParse(req.params.id);
    const parsedHash = hashSchema.safeParse(req.query.hash);
    if (!parsedId.success || !parsedHash.success) {
      return res.status(400).json({ error: "Certificate id and SHA-256 hash are required" });
    }

    const certificate = await store.getCertificate(parsedId.data);
    if (!certificate) return res.status(404).json({ valid: false, error: "Certificate not found" });

    let blockchain = null;
    if (certificate.blockchainId && certificateRegistry.configured) {
      blockchain = await certificateRegistry.verify(certificate.blockchainId, parsedHash.data);
    }

    const hashMatches = certificate.documentHash.toLowerCase() === parsedHash.data.toLowerCase();
    const valid = certificate.status === "active" && hashMatches && (!blockchain || (blockchain.exists && blockchain.active && blockchain.hashMatches));

    await audit("public-verifier", "certificate.verify", certificate.id, { valid });

    return res.json({
      valid,
      certificate: {
        id: certificate.id,
        blockchainId: certificate.blockchainId,
        studentName: certificate.studentName,
        title: certificate.title,
        institution: certificate.institution,
        issuedAt: certificate.issuedAt,
        status: certificate.status,
      },
      checks: {
        existsOffChain: true,
        hashMatches,
        blockchain,
      },
    });
  });

  app.get("/api/audit", authenticate, authorize("admin"), async (_req, res) => {
    res.json({ items: await store.listAudit() });
  });

  app.use((error: unknown, _req: Request, res: Response, _next: NextFunction) => {
    console.error(error);
    res.status(500).json({ error: "Unexpected server error" });
  });

  return app;
}
