import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { Pool } from "pg";
import { config } from "./config.js";
import { AuditEvent, CertificateRecord } from "./domain.js";

interface PersistedState {
  certificates: CertificateRecord[];
  audit: AuditEvent[];
}

export interface Store {
  readonly kind: "json" | "postgres";
  init(): Promise<void>;
  healthcheck(): Promise<boolean>;
  listCertificates(): Promise<CertificateRecord[]>;
  getCertificate(id: string): Promise<CertificateRecord | undefined>;
  saveCertificate(certificate: CertificateRecord): Promise<void>;
  appendAudit(event: AuditEvent): Promise<void>;
  listAudit(): Promise<AuditEvent[]>;
}

export class JsonStore implements Store {
  readonly kind = "json" as const;
  private state: PersistedState = { certificates: [], audit: [] };
  private initialized = false;
  private readonly dataFile: string;

  constructor(dataFile = resolve(process.cwd(), config.CERTICHAIN_DATA_FILE)) {
    this.dataFile = dataFile;
  }

  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(this.dataFile), { recursive: true });

    try {
      this.state = JSON.parse(await readFile(this.dataFile, "utf8")) as PersistedState;
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

  async getCertificate(id: string): Promise<CertificateRecord | undefined> {
    await this.init();
    return this.state.certificates.find((certificate) => certificate.id === id || certificate.blockchainId === id);
  }

  async saveCertificate(certificate: CertificateRecord): Promise<void> {
    await this.init();
    const index = this.state.certificates.findIndex((current) => current.id === certificate.id);
    if (index >= 0) this.state.certificates[index] = certificate;
    else this.state.certificates.push(certificate);
    await this.persist();
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.init();
    this.state.audit.push(event);
    await this.persist();
  }

  async listAudit(): Promise<AuditEvent[]> {
    await this.init();
    return [...this.state.audit].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private async persist(): Promise<void> {
    const tempFile = `${this.dataFile}.tmp`;
    await writeFile(tempFile, JSON.stringify(this.state, null, 2), "utf8");
    await rename(tempFile, this.dataFile);
  }
}

export class PostgresStore implements Store {
  readonly kind = "postgres" as const;
  private initialized = false;
  private readonly pool: Pool;

  constructor(connectionString: string) {
    this.pool = new Pool({ connectionString, max: 10, idleTimeoutMillis: 30_000, connectionTimeoutMillis: 5_000 });
  }

  async init(): Promise<void> {
    if (this.initialized) return;

    await this.pool.query(`
      CREATE TABLE IF NOT EXISTS certificates (
        id UUID PRIMARY KEY,
        blockchain_id TEXT UNIQUE,
        student_name TEXT NOT NULL,
        student_wallet TEXT NOT NULL,
        title TEXT NOT NULL,
        institution TEXT NOT NULL,
        issued_at DATE NOT NULL,
        document_hash TEXT NOT NULL,
        metadata_uri TEXT NOT NULL,
        status TEXT NOT NULL CHECK (status IN ('pending','active','revoked')),
        issuer_email TEXT NOT NULL,
        created_at TIMESTAMPTZ NOT NULL,
        revoked_at TIMESTAMPTZ
      );

      CREATE INDEX IF NOT EXISTS idx_certificates_created_at ON certificates(created_at DESC);
      CREATE INDEX IF NOT EXISTS idx_certificates_document_hash ON certificates(document_hash);

      CREATE TABLE IF NOT EXISTS audit_events (
        id UUID PRIMARY KEY,
        actor TEXT NOT NULL,
        action TEXT NOT NULL,
        entity_id TEXT,
        timestamp TIMESTAMPTZ NOT NULL,
        metadata JSONB
      );

      CREATE INDEX IF NOT EXISTS idx_audit_timestamp ON audit_events(timestamp DESC);
    `);

    this.initialized = true;
  }

  async healthcheck(): Promise<boolean> {
    await this.init();
    const result = await this.pool.query<{ ok: number }>("SELECT 1 AS ok");
    return result.rows[0]?.ok === 1;
  }

  async listCertificates(): Promise<CertificateRecord[]> {
    await this.init();
    const result = await this.pool.query("SELECT * FROM certificates ORDER BY created_at DESC");
    return result.rows.map(mapCertificateRow);
  }

  async getCertificate(id: string): Promise<CertificateRecord | undefined> {
    await this.init();
    const result = await this.pool.query(
      "SELECT * FROM certificates WHERE id::text = $1 OR blockchain_id = $1 LIMIT 1",
      [id],
    );
    return result.rows[0] ? mapCertificateRow(result.rows[0]) : undefined;
  }

  async saveCertificate(certificate: CertificateRecord): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO certificates (
        id, blockchain_id, student_name, student_wallet, title, institution, issued_at,
        document_hash, metadata_uri, status, issuer_email, created_at, revoked_at
      ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)
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
        revoked_at = EXCLUDED.revoked_at`,
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
      ],
    );
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.init();
    await this.pool.query(
      `INSERT INTO audit_events (id, actor, action, entity_id, timestamp, metadata)
       VALUES ($1,$2,$3,$4,$5,$6)`,
      [event.id, event.actor, event.action, event.entityId ?? null, event.timestamp, event.metadata ?? null],
    );
  }

  async listAudit(): Promise<AuditEvent[]> {
    await this.init();
    const result = await this.pool.query("SELECT * FROM audit_events ORDER BY timestamp DESC");
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

function mapCertificateRow(row: Record<string, unknown>): CertificateRecord {
  return {
    id: String(row.id),
    blockchainId: row.blockchain_id ? String(row.blockchain_id) : undefined,
    studentName: String(row.student_name),
    studentWallet: String(row.student_wallet),
    title: String(row.title),
    institution: String(row.institution),
    issuedAt: new Date(row.issued_at as string | Date).toISOString().slice(0, 10),
    documentHash: String(row.document_hash),
    metadataURI: String(row.metadata_uri),
    status: row.status as CertificateRecord["status"],
    issuerEmail: String(row.issuer_email),
    createdAt: new Date(row.created_at as string | Date).toISOString(),
    revokedAt: row.revoked_at ? new Date(row.revoked_at as string | Date).toISOString() : undefined,
  };
}

export const store: Store = config.DATABASE_URL
  ? new PostgresStore(config.DATABASE_URL)
  : new JsonStore();
