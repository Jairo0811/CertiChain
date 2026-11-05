import { randomUUID } from "node:crypto";
import { type NextFunction, type Request, type Response } from "express";

export function requestSecurity(req: Request, res: Response, next: NextFunction): void {
  const supplied = req.header("x-request-id");
  // Only accept correlation ids with a safe shape; never reflect arbitrary header content.
  const requestId = supplied && /^[A-Za-z0-9._:-]{1,128}$/.test(supplied) ? supplied : randomUUID();
  res.locals.requestId = requestId;
  res.setHeader("x-request-id", requestId);
  res.setHeader("cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  next();
}

type Bucket = { count: number; resetAt: number };

export interface RateLimitPolicy {
  /** Unique policy name. Each policy owns an isolated counter namespace. */
  name: string;
  windowMs: number;
  max: number;
  /** Upper bound of tracked clients per policy; protects memory against key-flooding. */
  maxKeys?: number;
}

/**
 * In-memory fixed-window rate limiter.
 *
 * - Every policy has its own counter map, so general, login and verification
 *   limits never consume each other's budget.
 * - The client key is `req.ip`, which Express derives from `X-Forwarded-For`
 *   only when `trust proxy` is explicitly configured (see TRUST_PROXY). The raw
 *   header is never read here, so it cannot be spoofed to bypass the limit.
 * - Expired buckets are swept and the map is capped, so it cannot grow without bound.
 *
 * This is suitable for a single API instance. Horizontally scaled deployments
 * should move the counters to a shared store (e.g. Redis) behind the same interface.
 */
export function rateLimit(policy: RateLimitPolicy) {
  const buckets = new Map<string, Bucket>();
  const maxKeys = policy.maxKeys ?? 10_000;
  let lastSweep = Date.now();

  function sweep(now: number) {
    for (const [key, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(key);
    }
    lastSweep = now;
  }

  const middleware = (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    if (now - lastSweep >= policy.windowMs || buckets.size >= maxKeys) sweep(now);

    const key = req.ip || req.socket.remoteAddress || "unknown";
    let bucket = buckets.get(key);
    if (!bucket || bucket.resetAt <= now) {
      if (!bucket && buckets.size >= maxKeys) {
        // Still saturated after sweeping: evict the oldest entry (Map keeps insertion order).
        const oldest = buckets.keys().next().value;
        if (oldest !== undefined) buckets.delete(oldest);
      }
      bucket = { count: 0, resetAt: now + policy.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;

    res.setHeader("ratelimit-policy", `${policy.max};w=${Math.round(policy.windowMs / 1000)};name="${policy.name}"`);
    res.setHeader("ratelimit-limit", String(policy.max));
    res.setHeader("ratelimit-remaining", String(Math.max(policy.max - bucket.count, 0)));
    res.setHeader("ratelimit-reset", String(Math.max(Math.ceil((bucket.resetAt - now) / 1000), 0)));

    if (bucket.count > policy.max) {
      res.setHeader("retry-after", String(Math.max(Math.ceil((bucket.resetAt - now) / 1000), 1)));
      res.status(429).json({ error: "Too many requests. Try again later.", code: "rate_limited" });
      return;
    }

    next();
  };

  return Object.assign(middleware, {
    /** Number of tracked clients; exposed for tests and diagnostics. */
    size: () => buckets.size,
    reset: () => buckets.clear(),
  });
}

/**
 * Parses TRUST_PROXY into a value accepted by Express' `trust proxy` setting.
 * Defaults to `false`: X-Forwarded-For is ignored unless a proxy is declared.
 */
export function parseTrustProxy(value: string | undefined): boolean | number | string {
  if (value === undefined || value === "" || value === "false") return false;
  if (value === "true") return true;
  if (/^\d+$/.test(value)) return Number(value);
  // Comma separated list of trusted addresses/subnets, e.g. "loopback, 10.0.0.0/8".
  return value;
}

export function maskPersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => (part.length <= 1 ? "*" : `${part[0]}${"*".repeat(Math.min(part.length - 1, 5))}`))
    .join(" ");
}
