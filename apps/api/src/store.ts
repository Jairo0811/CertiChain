import { randomUUID } from "node:crypto";
import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import { config } from "./config.js";
import { type AuditEvent, type CertificateRecord, type CertificateStatus } from "./domain.js";
import { migrations } from "./migrations.js";

interface PersistedState {
  certificates: CertificateRecord[];
  audit: AuditEvent[];
}

export type CertificateSortField = "createdAt" | "issuedAt" | "studentName" | "title" | "institution" | "status";

export interface CertificateQuery {
  search?: string;
  status?: CertificateStatus;
  sort?: CertificateSortField;
  direction?: "asc" | "desc";
  page: number;
  pageSize: number;
}

export interface CertificatePage {
  items: CertificateRecord[];
  total: number;
}

export interface AuditQuery {
  limit?: number;
  since?: string;
  entityId?: string;
  actions?: AuditEvent["action"][];
}

export interface Store {
  readonly kind: "json" | "postgres";
  init(): Promise<void>;
  healthcheck(): Promise<boolean>;
  listCertificates(): Promise<CertificateRecord[]>;
  queryCertificates(query: CertificateQuery): Promise<CertificatePage>;
  getCertificate(id: string): Promise<CertificateRecord | undefined>;
  saveCertificate(certificate: CertificateRecord): Promise<void>;
  deleteCertificate(id: string): Promise<boolean>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(query?: AuditQuery): Promise<AuditEvent[]>;
}

const DEFAULT_AUDIT_LIMIT = 200;
const MAX_AUDIT_LIMIT = 1000;

function auditLimit(query?: AuditQuery): number {
  return Math.min(Math.max(query?.limit ?? DEFAULT_AUDIT_LIMIT, 1), MAX_AUDIT_LIMIT);
}

/** Case and accent-insensitive normalization shared by in-memory search. */
function normalizeSearch(value: string): string {
  return value.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
}

export function matchesCertificateQuery(certificate: CertificateRecord, query: Pick<CertificateQuery, "search" | "status">) {
  if (query.status && certificate.status !== query.status) return false;
  const term = normalizeSearch(query.search?.trim() ?? "");
  if (!term) return true;
  const haystack = normalizeSearch(
    [certificate.studentName, certificate.title, certificate.institution, certificate.id, certificate.blockchainId ?? ""].join(
      " ",
    ),
  );
  return haystack.includes(term);
}

export function compareCertificates(field: CertificateSortField, direction: "asc" | "desc") {
  const factor = direction === "asc" ? 1 : -1;
  return (a: CertificateRecord, b: CertificateRecord) => {
    const primary = String(a[field] ?? "").localeCompare(String(b[field] ?? ""), "es", { sensitivity: "base" });
    if (primary !== 0) return primary * factor;
    // Stable tie-breaker so pagination never repeats or skips rows.
    return a.id.localeCompare(b.id) * factor;
  };
}

export class JsonStore implements Store {
  readonly kind = "json" as const;
  private state: PersistedState = { certificates: [], audit: [] };
  private initialized = false;
  private readonly dataFile: string;
  private persistQueue: Promise<void> = Promise.resolve();

  constructor(dataFile = resolve(process.cwd(), config.CERTICHAIN_DATA_FILE)) {
    this.dataFile = dataFile;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.dataFile), { recursive: true });

    try {
      const parsed = JSON.parse(await readFile(this.dataFile, "utf8")) as Partial<PersistedState>;
      this.state = { certificates: parsed.certificates ?? [], audit: parsed.audit ?? [] };
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }

    this.initialized = true;
  }

  async healthcheck(): Promise<boolean> {
    await this.init();
    return true;
  }

  async listCertificates(): Promise<CertificateRecord[]> {
    await this.init();
    return [...this.state.certificates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async queryCertificates(query: CertificateQuery): Promise<CertificatePage> {
    await this.init();
    const filtered = this.state.certificates
      .filter((certificate) => matchesCertificateQuery(certificate, query))
      .sort(compareCertificates(query.sort ?? "createdAt", query.direction ?? "desc"));
    const start = (query.page - 1) * query.pageSize;
    return { items: filtered.slice(start, start + query.pageSize), total: filtered.length };
  }

  async getCertificate(id: string): Promise<CertificateRecord | undefined> {
    await this.init();
    const found = this.state.certificates.find((certificate) => certificate.id === id || certificate.blockchainId === id);
    return found ? { ...found } : undefined;
  }

  async saveCertificate(certificate: CertificateRecord): Promise<void> {
    await this.init();
    const copy = { ...certificate };
    const index = this.state.certificates.findIndex((current) => current.id === certificate.id);
    if (index >= 0) this.state.certificates[index] = copy;
    else this.state.certificates.push(copy);
    await this.persist();
  }

  async deleteCertificate(id: string): Promise<boolean> {
    await this.init();
    const index = this.state.certificates.findIndex((certificate) => certificate.id === id || certificate.blockchainId === id);
    if (index < 0) return false;
    this.state.certificates.splice(index, 1);
    await this.persist();
    return true;
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.init();
    this.state.audit.push(event);
    await this.persist();
  }

  async listAudit(query?: AuditQuery): Promise<AuditEvent[]> {
    await this.init();
    return this.state.audit
      .filter((event) => !query?.since || event.timestamp >= query.since)
      .filter((event) => !query?.entityId || event.entityId === query.entityId)
      .filter((event) => !query?.actions?.length || query.actions.includes(event.action))
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp))
      .slice(0, auditLimit(query));
  }

  private async persist(): Promise<void> {
    const snapshot = JSON.stringify(this.state, null, 2);
    const writeSnapshot = async () => {
      const tempFile = `${this.dataFile}.${process.pid}.${randomUUID()}.tmp`;
      await writeFile(tempFile, snapshot, "utf8");
      await rename(tempFile, this.dataFile);
    };

    const next = this.persistQueue.then(writeSnapshot, writeSnapshot);
    this.persistQueue = next;
    await next;
  }
}

const SORT_COLUMNS: Record<CertificateSortField, string> = {
  createdAt: "created_at",
  issuedAt: "issued_at",
  studentName: "student_name",
  title: "title",
  institution: "institution",
  status: "status",
};

/** Arbitrary but stable key used to serialize concurrent migration runs across API replicas. */
const MIGRATION_LOCK_KEY = 915_2026;

export class PostgresStore implements Store {
  readonly kind = "postgres" as const;
  private initialization?: Promise<void>;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
    this.pool.on("error", (error) => {
      console.error(JSON.stringify({ level: "error", event: "postgres_pool_error", message: error.message }));
    });
  }

  init(): Promise<void> {
    // Share a single in-flight initialization so concurrent first requests do not race.
    this.initialization ??= this.migrate().catch((error) => {
      this.initialization = undefined;
      throw error;
    });
    return this.initialization;
  }

  /** Applies pending versioned migrations inside a transaction guarded by an advisory lock. */
  private async migrate(): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query("SELECT pg_advisory_lock($1)", [MIGRATION_LOCK_KEY]);
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          version INTEGER PRIMARY KEY,
          name TEXT NOT NULL,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);
      const applied = await client.query<{ version: number }>("SELECT version FROM schema_migrations");
      const appliedVersions = new Set(applied.rows.map((row) => Number(row.version)));

      for (const migration of migrations) {
        if (appliedVersions.has(migration.version)) continue;
        await client.query("BEGIN");
        try {
          await client.query(migration.sql);
          await client.query("INSERT INTO schema_migrations (version, name) VALUES ($1, $2)", [
            migration.version,
            migration.name,
          ]);
          await client.query("COMMIT");
        } catch (error) {
          await client.query("ROLLBACK");
          throw error;
        }
      }
    } finally {
      await client.query("SELECT pg_advisory_unlock($1)", [MIGRATION_LOCK_KEY]).catch(() => undefined);
      client.release();
    }
  }

  async appliedMigrations(): Promise<number[]> {
    await this.init();
    const result = await this.pool.query<{ version: number }>("SELECT version FROM schema_migrations ORDER BY version");
    return result.rows.map((row) => Number(row.version));
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  async healthcheck(): Promise<boolean> {
    await this.init();
    const result = await this.pool.query<{ ok: number }>("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async listCertificates(): Promise<CertificateRecord[]> {
    await this.init();
    const result = await this.pool.query("SELECT * FROM certificates ORDER BY created_at DESC, id DESC");
    return result.rows.map(mapCertificateRow);
  }

  async queryCertificates(query: CertificateQuery): Promise<CertificatePage> {
    await this.init();
    const where: string[] = [];
    const params: unknown[] = [];

    if (query.status) {
      params.push(query.status);
      where.push(`status = $${params.length}`);
    }
    const term = query.search?.trim();
    if (term) {
      // Escape LIKE wildcards so user input is matched literally.
      params.push(`%${term.replace(/[\\%_]/g, (match) => `\\${match}`)}%`);
      const placeholder = `$${params.length}`;
      where.push(
        `(student_name ILIKE ${placeholder} OR title ILIKE ${placeholder} OR institution ILIKE ${placeholder}` +
          ` OR id::text ILIKE ${placeholder} OR COALESCE(blockchain_id, '') ILIKE ${placeholder})`,
      );
    }

    const whereSql = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const column = SORT_COLUMNS[query.sort ?? "createdAt"];
    const direction = query.direction === "asc" ? "ASC" : "DESC";

    const total = await this.pool.query<{ count: string }>(
      `SELECT COUNT(*)::text AS count FROM certificates ${whereSql}`,
      params,
    );
    const pageParams = [...params, query.pageSize, (query.page - 1) * query.pageSize];
    const rows = await this.pool.query(
      `SELECT * FROM certificates ${whereSql}
       ORDER BY ${column} ${direction}, id ${direction}
       LIMIT $${pageParams.length - 1} OFFSET $${pageParams.length}`,
      pageParams,
    );

    return { items: rows.rows.map(mapCertificateRow), total: Number(total.rows[0]?.count ?? 0) };
  }

  async getCertificate(id: string): Promise<CertificateRecord | undefined> {
    await this.init();
    const result = await this.pool.query("SELECT * FROM certificates WHERE id::text = $1 OR blockchain_id = $1 LIMIT 1", [id]);
    return result.rows[0] ? mapCertificateRow(result.rows[0]) : undefined;
  }

  async saveCertificate(certificate: CertificateRecord): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO certificates (
        id, blockchain_id, student_name, student_wallet, title, institution, issued_at,
        document_hash, metadata_uri, status, issuer_email, created_at, revoked_at,
        chain_sync_status, chain_tx_hash, chain_revoke_tx_hash, chain_error, updated_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18)
      ON CONFLICT (id) DO UPDATE SET
        blockchain_id = EXCLUDED.blockchain_id,
        student_name = EXCLUDED.student_name,
        student_wallet = EXCLUDED.student_wallet,
        title = EXCLUDED.title,
        institution = EXCLUDED.institution,
        issued_at = EXCLUDED.issued_at,
        document_hash = EXCLUDED.document_hash,
        metadata_uri = EXCLUDED.metadata_uri,
        status = EXCLUDED.status,
        issuer_email = EXCLUDED.issuer_email,
        revoked_at = EXCLUDED.revoked_at,
        chain_sync_status = EXCLUDED.chain_sync_status,
        chain_tx_hash = EXCLUDED.chain_tx_hash,
        chain_revoke_tx_hash = EXCLUDED.chain_revoke_tx_hash,
        chain_error = EXCLUDED.chain_error,
        updated_at = EXCLUDED.updated_at`,
      [
        certificate.id,
        certificate.blockchainId ?? null,
        certificate.studentName,
        certificate.studentWallet,
        certificate.title,
        certificate.institution,
        certificate.issuedAt,
        certificate.documentHash,
        certificate.metadataURI,
        certificate.status,
        certificate.issuerEmail,
        certificate.createdAt,
        certificate.revokedAt ?? null,
        certificate.chainSyncStatus ?? null,
        certificate.chainTxHash ?? null,
        certificate.chainRevokeTxHash ?? null,
        certificate.chainError ?? null,
        certificate.updatedAt ?? null,
      ],
    );
  }

  async deleteCertificate(id: string): Promise<boolean> {
    await this.init();
    const result = await this.pool.query("DELETE FROM certificates WHERE id::text = $1 OR blockchain_id = $1", [id]);
    return (result.rowCount ?? 0) > 0;
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO audit_events (id, actor, action, entity_id, timestamp, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [event.id, event.actor, event.action, event.entityId ?? null, event.timestamp, event.metadata ?? null],
    );
  }

  async listAudit(query?: AuditQuery): Promise<AuditEvent[]> {
    await this.init();
    const where: string[] = [];
    const params: unknown[] = [];
    if (query?.since) {
      params.push(query.since);
      where.push(`timestamp >= $${params.length}`);
    }
    if (query?.entityId) {
      params.push(query.entityId);
      where.push(`entity_id = $${params.length}`);
    }
    if (query?.actions?.length) {
      params.push(query.actions);
      where.push(`action = ANY($${params.length})`);
    }
    params.push(auditLimit(query));
    const result = await this.pool.query(
      `SELECT * FROM audit_events ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
       ORDER BY timestamp DESC LIMIT $${params.length}`,
      params,
    );
    return result.rows.map((row) => ({
      id: String(row.id),
      actor: String(row.actor),
      action: row.action as AuditEvent["action"],
      entityId: row.entity_id ? String(row.entity_id) : undefined,
      timestamp: new Date(row.timestamp as string | Date).toISOString(),
      metadata: (row.metadata as Record<string, unknown> | null) ?? undefined,
    }));
  }
}

function toIsoDate(value: unknown): string {
  if (value instanceof Date) {
    // DATE columns come back as local-midnight Date objects; format without UTC shifting.
    const year = value.getFullYear();
    const month = String(value.getMonth() + 1).padStart(2, "0");
    const day = String(value.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  }
  return String(value).slice(0, 10);
}

function mapCertificateRow(row: Record<string, unknown>): CertificateRecord {
  return {
    id: String(row.id),
    blockchainId: row.blockchain_id ? String(row.blockchain_id) : undefined,
    studentName: String(row.student_name),
    studentWallet: String(row.student_wallet),
    title: String(row.title),
    institution: String(row.institution),
    issuedAt: toIsoDate(row.issued_at),
    documentHash: String(row.document_hash),
    metadataURI: String(row.metadata_uri),
    status: row.status as CertificateRecord["status"],
    issuerEmail: String(row.issuer_email),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string | Date).toISOString() : undefined,
    chainSyncStatus: (row.chain_sync_status as CertificateRecord["chainSyncStatus"] | null) ?? undefined,
    chainTxHash: row.chain_tx_hash ? String(row.chain_tx_hash) : undefined,
    chainRevokeTxHash: row.chain_revoke_tx_hash ? String(row.chain_revoke_tx_hash) : undefined,
    chainError: row.chain_error ? String(row.chain_error) : undefined,
    updatedAt: row.updated_at ? new Date(row.updated_at as string | Date).toISOString() : undefined,
  };
}

export const store: Store = config.DATABASE_URL ? new PostgresStore(config.DATABASE_URL) : new JsonStore();
