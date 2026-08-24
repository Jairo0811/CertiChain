import { NextFunction, Request, Response } from "express";

const startedAt = Date.now();
let totalRequests = 0;
let totalErrors = 0;
const statusCounts = new Map<number, number>();

export function observability(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();
  totalRequests += 1;

  res.on("finish", () => {
    const durationMs = Number(process.hrtime.bigint() - start) / 1_000_000;
    statusCounts.set(res.statusCode, (statusCounts.get(res.statusCode) ?? 0) + 1);
    if (res.statusCode >= 500) totalErrors += 1;

    const requestId = res.getHeader("x-request-id");
    console.log(JSON.stringify({
      level: res.statusCode >= 500 ? "error" : "info",
      event: "http_request",
      requestId,
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      durationMs: Math.round(durationMs * 100) / 100,
    }));
  });

  next();
}

export function renderPrometheusMetrics(): string {
  const uptimeSeconds = Math.floor((Date.now() - startedAt) / 1000);
  const memory = process.memoryUsage();
  const lines = [
    "# HELP certichain_uptime_seconds Process uptime in seconds.",
    "# TYPE certichain_uptime_seconds gauge",
    `certichain_uptime_seconds ${uptimeSeconds}`,
    "# HELP certichain_http_requests_total Total HTTP requests.",
    "# TYPE certichain_http_requests_total counter",
    `certichain_http_requests_total ${totalRequests}`,
    "# HELP certichain_http_errors_total Total HTTP 5xx responses.",
    "# TYPE certichain_http_errors_total counter",
    `certichain_http_errors_total ${totalErrors}`,
    "# HELP certichain_process_resident_memory_bytes Resident memory size.",
    "# TYPE certichain_process_resident_memory_bytes gauge",
    `certichain_process_resident_memory_bytes ${memory.rss}`,
  ];

  for (const [status, count] of [...statusCounts.entries()].sort(([a], [b]) => a - b)) {
    lines.push(`certichain_http_responses_total{status="${status}"} ${count}`);
  }

  return `${lines.join("\n")}\n`;
}
