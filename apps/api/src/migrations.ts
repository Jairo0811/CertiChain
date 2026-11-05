/**
 * Versioned PostgreSQL migrations.
 *
 * Rules:
 * - Migrations are append-only. Never edit or reorder an applied migration.
 * - Every statement must be safe against existing data: no DROP/recreate of tables that hold
 *   certificates, hashes or audit events.
 * - Migration 1 mirrors the schema previously created inside `init()` with IF NOT EXISTS, so
 *   databases created by earlier releases are adopted without changes.
 */
export interface Migration {
  version: number;
  name: string;
  sql: string;
}

export const migrations: Migration[] = [
  {
    version: 1,
    name: "baseline_schema",
    sql: `
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
    `,
  },
  {
    version: 2,
    name: "chain_sync_and_query_indexes",
    sql: `
      ALTER TABLE certificates ADD COLUMN IF NOT EXISTS chain_sync_status TEXT;
      ALTER TABLE certificates ADD COLUMN IF NOT EXISTS chain_tx_hash TEXT;
      ALTER TABLE certificates ADD COLUMN IF NOT EXISTS chain_revoke_tx_hash TEXT;
      ALTER TABLE certificates ADD COLUMN IF NOT EXISTS chain_error TEXT;
      ALTER TABLE certificates ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;

      DO $$
      BEGIN
        IF NOT EXISTS (
          SELECT 1 FROM pg_constraint WHERE conname = 'certificates_chain_sync_status_check'
        ) THEN
          ALTER TABLE certificates ADD CONSTRAINT certificates_chain_sync_status_check
            CHECK (chain_sync_status IS NULL OR chain_sync_status IN
              ('not_requested','submitting','submitted','anchored','failed'));
        END IF;
      END $$;

      CREATE UNIQUE INDEX IF NOT EXISTS idx_certificates_chain_tx_hash
        ON certificates(chain_tx_hash) WHERE chain_tx_hash IS NOT NULL;
      CREATE INDEX IF NOT EXISTS idx_certificates_status ON certificates(status);
      CREATE INDEX IF NOT EXISTS idx_certificates_issued_at ON certificates(issued_at DESC);
      CREATE INDEX IF NOT EXISTS idx_certificates_institution ON certificates(institution);
      CREATE INDEX IF NOT EXISTS idx_audit_entity ON audit_events(entity_id, timestamp DESC);
      CREATE INDEX IF NOT EXISTS idx_audit_action_timestamp ON audit_events(action, timestamp DESC);
    `,
  },
];
