export type CertificateStatus = "pending" | "active" | "revoked";

export type CredentialReference = {
  id: string;
  hash?: string;
};

export function parseCredentialReference(value: string): CredentialReference {
  const trimmed = value.trim();
  if (!trimmed) return { id: "" };

  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const hash = url.searchParams.get("hash")?.trim() || undefined;
    return { id, hash };
  } catch {
    return { id: trimmed };
  }
}

export function statusLabel(status?: CertificateStatus): string {
  if (status === "active") return "Vigente";
  if (status === "revoked") return "Revocada";
  if (status === "pending") return "Pendiente";
  return "Sin estado";
}

export function verificationVerdict(valid: boolean, status?: CertificateStatus): string {
  if (valid) return "Credencial válida";
  if (status === "revoked") return "Credencial revocada";
  if (status === "pending") return "Credencial pendiente";
  return "Credencial no verificada";
}
