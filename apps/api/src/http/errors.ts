import type { NextFunction, Request, Response } from "express";
import { z } from "zod";

/** Stable, machine-readable error codes shared with the web and mobile clients. */
export type ErrorCode =
  | "validation_failed"
  | "unauthenticated"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "invalid_credentials"
  | "rate_limited"
  | "payload_too_large"
  | "unsupported_media_type"
  | "blockchain_unavailable"
  | "blockchain_not_configured"
  | "storage_unavailable"
  | "integrity_failure"
  | "internal_error";

export class HttpError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ErrorCode,
    message: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

export const badRequest = (message: string, details?: unknown) =>
  new HttpError(400, "validation_failed", message, details);
export const notFound = (message = "Certificate not found") => new HttpError(404, "not_found", message);
export const conflict = (message: string) => new HttpError(409, "conflict", message);

/** Parses input with a Zod schema and throws a uniform 400 with field-level details. */
export function parseOrThrow<S extends z.ZodTypeAny>(schema: S, value: unknown, message: string): z.output<S> {
  const parsed = schema.safeParse(value);
  if (!parsed.success) throw badRequest(message, parsed.error.flatten());
  return parsed.data;
}

function logError(requestId: unknown, error: unknown) {
  console.error(
    JSON.stringify({
      level: "error",
      event: "unhandled_error",
      requestId,
      name: error instanceof Error ? error.name : typeof error,
      message: error instanceof Error ? error.message : String(error),
    }),
  );
}

/**
 * Uniform JSON error responses. Internal details never reach the client: unexpected errors become
 * a generic 500 carrying only the correlation id that also appears in the server logs.
 */
export function errorHandler(error: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const requestId = res.locals.requestId;

  if (error instanceof HttpError) {
    res.status(error.status).json({
      error: error.message,
      code: error.code,
      ...(error.details ? { details: error.details } : {}),
      requestId,
    });
    return;
  }

  // body-parser errors (malformed JSON, oversized payloads).
  const status = (error as { status?: number; type?: string })?.status;
  const type = (error as { type?: string })?.type;
  if (status === 413 || type === "entity.too.large") {
    res.status(413).json({ error: "Payload too large", code: "payload_too_large", requestId });
    return;
  }
  if (status === 400 && type === "entity.parse.failed") {
    res.status(400).json({ error: "Malformed JSON payload", code: "validation_failed", requestId });
    return;
  }

  logError(requestId, error);
  res.status(500).json({ error: "Unexpected server error", code: "internal_error", requestId });
}
