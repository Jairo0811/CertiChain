import { randomUUID } from "node:crypto";
import { NextFunction, Request, Response } from "express";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

export function requestSecurity(req: Request, res: Response, next: NextFunction): void {
  const requestId = req.header("x-request-id")?.slice(0, 128) || randomUUID();
  res.setHeader("x-request-id", requestId);
  res.setHeader("cache-control", "no-store");
  res.setHeader("pragma", "no-cache");
  res.setHeader("referrer-policy", "no-referrer");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");
  next();
}

export function rateLimit(options: { windowMs: number; max: number }) {
  return (req: Request, res: Response, next: NextFunction): void => {
    const now = Date.now();
    const forwarded = req.header("x-forwarded-for")?.split(",")[0]?.trim();
    const key = forwarded || req.ip || "unknown";
    const existing = buckets.get(key);
    const bucket = !existing || existing.resetAt <= now
      ? { count: 0, resetAt: now + options.windowMs }
      : existing;

    bucket.count += 1;
    buckets.set(key, bucket);

    res.setHeader("ratelimit-limit", String(options.max));
    res.setHeader("ratelimit-remaining", String(Math.max(options.max - bucket.count, 0)));
    res.setHeader("ratelimit-reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.status(429).json({ error: "Too many requests. Try again later." });
      return;
    }

    next();
  };
}

export function maskPersonName(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .map((part) => part.length <= 1 ? "*" : `${part[0]}${"*".repeat(Math.min(part.length - 1, 5))}`)
    .join(" ");
}
