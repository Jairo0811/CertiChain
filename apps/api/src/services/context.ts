import { randomUUID } from "node:crypto";
import type { CertificateRegistryClient } from "../blockchain.js";
import type { AuditEvent } from "../domain.js";
import type { Store } from "../store.js";

/** Dependencies shared by services. Injectable so tests can simulate RPC and storage failures. */
export interface ServiceContext {
  store: Store;
  registry: CertificateRegistryClient;
}

export async function audit(
  context: ServiceContext,
  actor: string,
  action: AuditEvent["action"],
  entityId?: string,
  metadata?: Record<string, unknown>,
): Promise<void> {
  await context.store.appendAudit({
    id: randomUUID(),
    actor,
    action,
    entityId,
    timestamp: new Date().toISOString(),
    metadata,
  });
}

/**
 * Serializes mutations per certificate inside this process so concurrent revoke/anchor/status
 * requests cannot interleave (e.g. two revocations sending two blockchain transactions).
 * Multi-replica deployments must additionally rely on database-level locking.
 */
const locks = new Map<string, Promise<unknown>>();

export async function withCertificateLock<T>(id: string, task: () => Promise<T>): Promise<T> {
  const previous = locks.get(id) ?? Promise.resolve();
  const run = previous.catch(() => undefined).then(task);
  const tail = run.catch(() => undefined);
  locks.set(id, tail);
  try {
    return await run;
  } finally {
    if (locks.get(id) === tail) locks.delete(id);
  }
}
