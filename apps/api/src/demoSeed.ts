import { createHash } from "node:crypto";
import { config } from "./config.js";
import { buildDemoCertificates, demoVerificationSample } from "./demoData.js";
import { store } from "./store.js";

function deterministicEventId(certificateId: string, kind: string): string {
  const hex = createHash("sha256").update(`demo-audit:${certificateId}:${kind}`).digest("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-4${hex.slice(13, 16)}-8${hex.slice(17, 20)}-${hex.slice(20, 32)}`;
}

async function main() {
  if (config.NODE_ENV === "production") {
    throw new Error("Portfolio demo data cannot be seeded with NODE_ENV=production");
  }

  await store.init();
  const certificates = buildDemoCertificates();

  for (const certificate of certificates) {
    await store.saveCertificate(certificate);

    // Real audit events for the seeded records (idempotent), so dashboard activity reflects them.
    const existing = await store.listAudit({ entityId: certificate.id, limit: 10 });
    const has = (action: string) => existing.some((event) => event.action === action);
    if (!has("certificate.issue")) {
      await store.appendAudit({
        id: deterministicEventId(certificate.id, "issue"),
        actor: certificate.issuerEmail,
        action: "certificate.issue",
        entityId: certificate.id,
        timestamp: certificate.createdAt,
        metadata: { demo: true, evidenceMode: "demo" },
      });
    }
    if (certificate.revokedAt && !has("certificate.revoke")) {
      await store.appendAudit({
        id: deterministicEventId(certificate.id, "revoke"),
        actor: certificate.issuerEmail,
        action: "certificate.revoke",
        entityId: certificate.id,
        timestamp: certificate.revokedAt,
        metadata: { demo: true, evidenceMode: "demo" },
      });
    }
  }

  console.log(
    JSON.stringify(
      {
        status: "ok",
        message: "CertiChain portfolio demo dataset seeded",
        persistence: store.kind,
        certificates: certificates.length,
        active: certificates.filter((item) => item.status === "active").length,
        revoked: certificates.filter((item) => item.status === "revoked").length,
        pending: certificates.filter((item) => item.status === "pending").length,
        institutions: new Set(certificates.map((item) => item.institution)).size,
        verificationSample: demoVerificationSample,
      },
      null,
      2,
    ),
  );
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
