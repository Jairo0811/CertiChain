import type { Certificate, VerificationSnapshot, WalletCredential } from "../types";

export const WALLET_KEY = "certichain-wallet-v1";
export const WALLET_LIMIT = 20;

export function credentialId(certificate: Pick<Certificate, "id" | "blockchainId">): string {
  return certificate.blockchainId ?? certificate.id;
}

export function verificationToWalletCredential(
  certificate: Certificate,
  documentHash: string,
  verifiedAt: string,
  existing?: WalletCredential,
  snapshot?: VerificationSnapshot,
): WalletCredential {
  return {
    id: certificate.id,
    blockchainId: certificate.blockchainId,
    studentName: certificate.studentName,
    title: certificate.title,
    institution: certificate.institution,
    issuedAt: certificate.issuedAt,
    status: certificate.status,
    documentHash: documentHash || existing?.documentHash || "",
    savedAt: existing?.savedAt ?? verifiedAt,
    verifiedAt,
    ...(snapshot ? { lastVerification: snapshot } : {}),
  };
}

export function upsertWalletCredential(
  wallet: WalletCredential[],
  certificate: Certificate,
  documentHash: string,
  verifiedAt: string,
  snapshot?: VerificationSnapshot,
): WalletCredential[] {
  const id = credentialId(certificate);
  const existing = wallet.find((item) => credentialId(item) === id);
  const credential = verificationToWalletCredential(certificate, documentHash, verifiedAt, existing, snapshot);

  return [credential, ...wallet.filter((item) => credentialId(item) !== id)]
    .sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt))
    .slice(0, WALLET_LIMIT);
}

export function normalizeWallet(value: unknown): WalletCredential[] {
  if (!Array.isArray(value)) return [];
  const seen = new Set<string>();
  const normalized: WalletCredential[] = [];

  for (const item of value) {
    if (!item || typeof item !== "object") continue;
    const candidate = item as Partial<WalletCredential>;
    if (
      typeof candidate.id !== "string" ||
      typeof candidate.title !== "string" ||
      typeof candidate.institution !== "string" ||
      typeof candidate.studentName !== "string" ||
      typeof candidate.issuedAt !== "string" ||
      typeof candidate.documentHash !== "string" ||
      typeof candidate.verifiedAt !== "string" ||
      !["pending", "active", "revoked"].includes(candidate.status ?? "")
    ) {
      continue;
    }

    const snapshot = candidate.lastVerification;
    const validSnapshot =
      snapshot && typeof snapshot === "object" && typeof snapshot.verifiedAt === "string" && typeof snapshot.outcome === "string"
        ? snapshot
        : undefined;
    const credential: WalletCredential = {
      ...(candidate as WalletCredential),
      savedAt: typeof candidate.savedAt === "string" ? candidate.savedAt : candidate.verifiedAt!,
      lastVerification: validSnapshot,
    };
    if (!validSnapshot) delete credential.lastVerification;
    const id = credentialId(credential);
    if (seen.has(id)) continue;
    seen.add(id);
    normalized.push(credential);
  }

  return normalized.sort((a, b) => Date.parse(b.verifiedAt) - Date.parse(a.verifiedAt)).slice(0, WALLET_LIMIT);
}
