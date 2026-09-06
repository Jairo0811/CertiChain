import { config } from "./config.js";
import { buildDemoCertificates, demoVerificationSample } from "./demoData.js";
import { store } from "./store.js";

async function main() {
  if (config.NODE_ENV === "production") {
    throw new Error("Portfolio demo data cannot be seeded with NODE_ENV=production");
  }

  await store.init();
  const certificates = buildDemoCertificates();

  for (const certificate of certificates) {
    await store.saveCertificate(certificate);
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
