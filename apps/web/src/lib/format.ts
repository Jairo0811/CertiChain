import type { AuditAction, BlockchainCheck, Certificate, CertificateStatus, EvidenceMode, VerificationOutcome } from "../types";

const dateFormatter = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric", timeZone: "UTC" });
const longDateFormatter = new Intl.DateTimeFormat("es-DO", { day: "numeric", month: "long", year: "numeric", timeZone: "UTC" });
const dateTimeFormatter = new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" });

/** Academic dates (YYYY-MM-DD) are calendar dates; format them in UTC to avoid off-by-one days. */
export function formatDate(value: string, long = false): string {
  const date = new Date(value.length === 10 ? `${value}T00:00:00Z` : value);
  if (Number.isNaN(date.getTime())) return value;
  return (long ? longDateFormatter : dateFormatter).format(date);
}

export function formatDateTime(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? value : dateTimeFormatter.format(date);
}

export function formatRelative(value: string, now = Date.now()): string {
  const diff = Math.round((Date.parse(value) - now) / 1000);
  const formatter = new Intl.RelativeTimeFormat("es", { numeric: "auto" });
  const abs = Math.abs(diff);
  if (abs < 60) return formatter.format(diff, "second");
  if (abs < 3600) return formatter.format(Math.round(diff / 60), "minute");
  if (abs < 86_400) return formatter.format(Math.round(diff / 3600), "hour");
  if (abs < 30 * 86_400) return formatter.format(Math.round(diff / 86_400), "day");
  return formatDate(value);
}

export function shortHash(value: string, head = 10, tail = 6): string {
  return value.length > head + tail + 1 ? `${value.slice(0, head)}…${value.slice(-tail)}` : value;
}

export function publicId(certificate: Pick<Certificate, "id" | "blockchainId">): string {
  return certificate.blockchainId ?? certificate.id;
}

export const STATUS_LABEL: Record<CertificateStatus, string> = {
  active: "Vigente",
  pending: "Pendiente",
  revoked: "Revocada",
};

export const MODE_LABEL: Record<EvidenceMode, string> = {
  "on-chain": "On-chain",
  "off-chain": "Off-chain",
  demo: "Demo",
};

export const MODE_DESCRIPTION: Record<EvidenceMode, string> = {
  "on-chain": "Anclada en el contrato CertificateRegistry. Su estado lo gobierna la blockchain.",
  "off-chain": "Registrada solo en la base de datos de CertiChain. No tiene ancla en blockchain.",
  demo: "Dataset ilustrativo de portafolio. Su identificador no corresponde a ninguna transacción real.",
};

export const OUTCOME_COPY: Record<VerificationOutcome, { title: string; body: string; tone: "success" | "warning" | "danger" | "neutral" }> = {
  valid: {
    title: "Credencial vigente",
    body: "El registro existe y está vigente, y todas las comprobaciones realizadas fueron satisfactorias.",
    tone: "success",
  },
  pending: {
    title: "Credencial pendiente",
    body: "La credencial está registrada, pero todavía no está activa. No debe aceptarse como vigente.",
    tone: "warning",
  },
  revoked: {
    title: "Credencial revocada",
    body: "La institución emisora revocó esta credencial. No debe aceptarse como vigente.",
    tone: "danger",
  },
  not_found: {
    title: "Credencial no encontrada",
    body: "No existe ninguna credencial con ese identificador en CertiChain. Revisa el ID o el código QR.",
    tone: "danger",
  },
  integrity_mismatch: {
    title: "El documento no coincide",
    body: "El SHA-256 del PDF presentado no coincide con la evidencia registrada. El archivo pudo haber sido modificado.",
    tone: "danger",
  },
  blockchain_mismatch: {
    title: "Discrepancia con la blockchain",
    body: "El registro de CertiChain no coincide con el ancla en blockchain. No debe aceptarse hasta aclararlo con la institución.",
    tone: "danger",
  },
  blockchain_not_configured: {
    title: "Blockchain no disponible en este entorno",
    body: "La credencial está anclada en blockchain, pero este servidor no tiene acceso al contrato. Solo se pudo consultar el registro de CertiChain.",
    tone: "warning",
  },
  blockchain_unavailable: {
    title: "Blockchain temporalmente inaccesible",
    body: "No se pudo consultar el contrato en este momento. Solo se consultó el registro de CertiChain; vuelve a intentarlo más tarde.",
    tone: "warning",
  },
};

export const BLOCKCHAIN_CHECK_COPY: Record<BlockchainCheck, { label: string; state: "ok" | "fail" | "skip" | "warn" }> = {
  verified: { label: "Ancla en blockchain confirmada y vigente", state: "ok" },
  hash_mismatch: { label: "El hash anclado en blockchain no coincide", state: "fail" },
  revoked_on_chain: { label: "Revocada en el contrato", state: "fail" },
  not_found_on_chain: { label: "No existe en el contrato", state: "fail" },
  not_configured: { label: "Contrato no configurado en este entorno", state: "warn" },
  unavailable: { label: "Red blockchain inaccesible ahora mismo", state: "warn" },
  not_anchored: { label: "Credencial off-chain: sin ancla en blockchain", state: "skip" },
  demo: { label: "Credencial demo: sin ancla en blockchain", state: "skip" },
};

export const ACTION_LABEL: Partial<Record<AuditAction, string>> = {
  "certificate.issue": "Emisión registrada",
  "certificate.revoke": "Credencial revocada",
  "certificate.status": "Cambio de estado off-chain",
  "certificate.delete": "Credencial de prueba eliminada",
  "certificate.anchor": "Anclaje blockchain",
  "certificate.verify": "Verificación pública",
  "document.upload": "Evidencia PDF cifrada",
  login: "Inicio de sesión",
};

export function pdfFilename(certificate: Pick<Certificate, "title" | "id">): string {
  const slug = certificate.title
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 48);
  return `certichain-${slug || "certificado"}-${certificate.id.slice(0, 8)}.pdf`;
}

export function verifyUrl(id: string): string {
  return `/verify?id=${encodeURIComponent(id)}&autoverify=1`;
}
