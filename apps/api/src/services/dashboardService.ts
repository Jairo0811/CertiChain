import type { AuditEvent, CertificateRecord, CertificateStatus } from "../domain.js";
import { evidenceMode } from "../certificateEvidence.js";
import type { ServiceContext } from "./context.js";

export type DashboardRange = "30" | "90" | "365" | "all";

export interface DashboardBucket {
  key: string;
  label: string;
  start: string;
  issued: number;
}

export interface DashboardActivity {
  id: string;
  action: AuditEvent["action"];
  actor: string;
  timestamp: string;
  certificateId?: string;
  title?: string;
  studentName?: string;
  metadata?: Record<string, unknown>;
}

export interface DashboardSummary {
  range: {
    key: DashboardRange;
    from: string | null;
    to: string;
    /** The cohort of every card and chart is defined by the academic issuance date. */
    dateBasis: "issuedAt";
    granularity: "day" | "week" | "month";
  };
  /** Credentials whose issuance date falls in the range, by their current status. */
  period: {
    issued: number;
    active: number;
    pending: number;
    revoked: number;
    institutions: number;
    /** Revocations whose revocation timestamp falls in the range (any issuance date). */
    revocationsInRange: number;
    onChain: number;
  };
  /** Whole registry, independent of the range. */
  allTime: { total: number; active: number; pending: number; revoked: number; institutions: number };
  /**
   * Comparison against the previous period of identical length. Null when it cannot be computed
   * honestly (open-ended range or no credentials issued in the previous period).
   */
  trend: { previousIssued: number; changePercent: number } | null;
  series: DashboardBucket[];
  byInstitution: Array<{ institution: string; issued: number }>;
  activity: DashboardActivity[];
}

const DAY_MS = 86_400_000;
const ACTIVITY_ACTIONS: AuditEvent["action"][] = [
  "certificate.issue",
  "certificate.revoke",
  "certificate.status",
  "certificate.delete",
  "certificate.anchor",
];

function utcDay(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function isoDay(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function countStatuses(certificates: CertificateRecord[]) {
  const counts: Record<CertificateStatus, number> = { active: 0, pending: 0, revoked: 0 };
  for (const certificate of certificates) counts[certificate.status] += 1;
  return counts;
}

function buildBuckets(range: DashboardRange, today: Date, certificates: CertificateRecord[]) {
  const granularity: DashboardSummary["range"]["granularity"] = range === "30" ? "day" : range === "90" ? "week" : "month";
  const buckets: DashboardBucket[] = [];
  const monthLabel = new Intl.DateTimeFormat("es-DO", { month: "short", year: "2-digit", timeZone: "UTC" });
  const dayLabel = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", timeZone: "UTC" });

  if (granularity === "month") {
    let months = 12;
    if (range === "all") {
      const earliest = certificates.reduce<string | null>(
        (min, item) => (min === null || item.issuedAt < min ? item.issuedAt : min),
        null,
      );
      if (earliest) {
        const first = new Date(`${earliest}T00:00:00Z`);
        months = (today.getUTCFullYear() - first.getUTCFullYear()) * 12 + today.getUTCMonth() - first.getUTCMonth() + 1;
      }
      months = Math.min(Math.max(months, 1), 60);
    }
    for (let offset = months - 1; offset >= 0; offset -= 1) {
      const start = new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() - offset, 1));
      buckets.push({ key: isoDay(start).slice(0, 7), label: monthLabel.format(start), start: isoDay(start), issued: 0 });
    }
    for (const certificate of certificates) {
      const bucket = buckets.find((item) => item.key === certificate.issuedAt.slice(0, 7));
      if (bucket) bucket.issued += 1;
    }
    return { granularity, buckets };
  }

  const size = granularity === "day" ? 1 : 7;
  const count = granularity === "day" ? 30 : 13;
  for (let index = count - 1; index >= 0; index -= 1) {
    const start = new Date(today.getTime() - (index * size + (size - 1)) * DAY_MS);
    buckets.push({ key: isoDay(start), label: dayLabel.format(start), start: isoDay(start), issued: 0 });
  }
  for (const certificate of certificates) {
    const day = certificate.issuedAt;
    for (let index = buckets.length - 1; index >= 0; index -= 1) {
      if (day >= buckets[index]!.start) {
        buckets[index]!.issued += 1;
        break;
      }
    }
  }
  return { granularity, buckets };
}

export async function buildDashboard(
  context: ServiceContext,
  range: DashboardRange,
  now = new Date(),
): Promise<DashboardSummary> {
  const today = utcDay(now);
  const todayIso = isoDay(today);
  const days = range === "all" ? null : Number(range);
  const fromDate = days === null ? null : new Date(today.getTime() - (days - 1) * DAY_MS);
  const from = fromDate ? isoDay(fromDate) : null;

  const all = await context.store.listCertificates();
  const inRange = all.filter((item) => (from === null || item.issuedAt >= from) && item.issuedAt <= todayIso);
  const periodCounts = countStatuses(inRange);
  const allCounts = countStatuses(all);

  let trend: DashboardSummary["trend"] = null;
  if (days !== null && fromDate) {
    const previousFrom = isoDay(new Date(fromDate.getTime() - days * DAY_MS));
    const previousIssued = all.filter((item) => item.issuedAt >= previousFrom && item.issuedAt < from!).length;
    if (previousIssued > 0) {
      trend = { previousIssued, changePercent: Math.round(((inRange.length - previousIssued) / previousIssued) * 1000) / 10 };
    }
  }

  const fromTimestamp = fromDate ? fromDate.toISOString() : undefined;
  const revocationsInRange = all.filter((item) => item.revokedAt && (!fromTimestamp || item.revokedAt >= fromTimestamp)).length;

  const institutions = new Map<string, number>();
  for (const certificate of inRange) {
    institutions.set(certificate.institution, (institutions.get(certificate.institution) ?? 0) + 1);
  }

  const events = await context.store.listAudit({ since: fromTimestamp, actions: ACTIVITY_ACTIONS, limit: 8 });
  const byId = new Map(all.map((item) => [item.id, item]));
  const activity = events.map((event): DashboardActivity => {
    const certificate = event.entityId ? byId.get(event.entityId) : undefined;
    return {
      id: event.id,
      action: event.action,
      actor: event.actor,
      timestamp: event.timestamp,
      certificateId: event.entityId,
      title: certificate?.title,
      studentName: certificate?.studentName,
      metadata: event.metadata,
    };
  });

  const { granularity, buckets } = buildBuckets(range, today, inRange);

  return {
    range: { key: range, from, to: todayIso, dateBasis: "issuedAt", granularity },
    period: {
      issued: inRange.length,
      ...periodCounts,
      institutions: institutions.size,
      revocationsInRange,
      onChain: inRange.filter((item) => evidenceMode(item) === "on-chain").length,
    },
    allTime: { total: all.length, ...allCounts, institutions: new Set(all.map((item) => item.institution)).size },
    trend,
    series: buckets,
    byInstitution: [...institutions.entries()]
      .map(([institution, issued]) => ({ institution, issued }))
      .sort((a, b) => b.issued - a.issued || a.institution.localeCompare(b.institution))
      .slice(0, 6),
    activity,
  };
}
