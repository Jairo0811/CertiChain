import { createHash, timingSafeEqual } from "node:crypto";
import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { z } from "zod";
import { config } from "../config.js";
import type { AuthUser, UserRole } from "../domain.js";
import { HttpError } from "./errors.js";

declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
    }
  }
}

const ISSUER = "certichain-api";
const AUDIENCE = "certichain-portal";

/** Claims are validated, never trusted as a blind cast of the decoded token. */
const claimsSchema = z.object({
  sub: z.string().min(1).max(128),
  email: z.string().email(),
  role: z.enum(["admin", "issuer", "verifier"]),
});

export interface IssuedToken {
  token: string;
  expiresAt: string;
}

export function createToken(user: AuthUser): IssuedToken {
  const expiresInSeconds = config.JWT_TTL_MINUTES * 60;
  const token = jwt.sign({ email: user.email, role: user.role }, config.JWT_SECRET, {
    algorithm: "HS256",
    expiresIn: expiresInSeconds,
    issuer: ISSUER,
    audience: AUDIENCE,
    subject: user.id,
  });
  return { token, expiresAt: new Date(Date.now() + expiresInSeconds * 1000).toISOString() };
}

export function verifyToken(token: string): AuthUser {
  const decoded = jwt.verify(token, config.JWT_SECRET, {
    algorithms: ["HS256"],
    issuer: ISSUER,
    audience: AUDIENCE,
  });
  const claims = claimsSchema.parse(decoded);
  return { id: claims.sub, email: claims.email, role: claims.role };
}

export function authenticate(req: Request, _res: Response, next: NextFunction): void {
  const header = req.headers.authorization ?? "";
  const match = /^Bearer\s+(\S+)$/i.exec(header);
  if (!match) throw new HttpError(401, "unauthenticated", "Authentication required");

  try {
    req.user = verifyToken(match[1]!);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new HttpError(401, "session_expired", "Session expired. Sign in again.");
    }
    throw new HttpError(401, "unauthenticated", "Invalid session token");
  }
  next();
}

export function authorize(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user || !roles.includes(req.user.role)) {
      throw new HttpError(403, "forbidden", "Insufficient permissions for this operation");
    }
    next();
  };
}

/** Constant-time comparison that does not leak the length of the expected secret. */
export function safeEqual(supplied: string, expected: string): boolean {
  const a = createHash("sha256").update(supplied).digest();
  const b = createHash("sha256").update(expected).digest();
  return timingSafeEqual(a, b);
}

/**
 * Single bootstrap administrator configured through environment variables. Production refuses the
 * development defaults (see config.ts). A multi-user directory with per-user password hashes is a
 * documented next step and can replace this function without touching route handlers.
 */
export function authenticateBootstrapAdmin(email: string, password: string): AuthUser | null {
  const emailMatches = safeEqual(email.trim().toLowerCase(), config.ADMIN_EMAIL.toLowerCase());
  const passwordMatches = safeEqual(password, config.ADMIN_PASSWORD);
  if (!emailMatches || !passwordMatches) return null;
  return { id: "local-admin", email: config.ADMIN_EMAIL, role: "admin" };
}
