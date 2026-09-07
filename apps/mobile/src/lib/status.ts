import type { CertificateStatus } from "../types";
import { colors } from "../theme/colors";

export type StatusTone = "success" | "warning" | "danger";

const statusMeta: Record<
  CertificateStatus,
  { label: string; color: string; tone: StatusTone; description: string }
> = {
  active: {
    label: "Vigente",
    color: colors.green,
    tone: "success",
    description: "La credencial está activa en el último estado consultado.",
  },
  pending: {
    label: "Pendiente",
    color: colors.amber,
    tone: "warning",
    description: "La credencial existe, pero todavía no está activa.",
  },
  revoked: {
    label: "Revocada",
    color: colors.red,
    tone: "danger",
    description: "La credencial fue revocada y no debe presentarse como vigente.",
  },
};

export function statusLabel(status: CertificateStatus): string {
  return statusMeta[status].label;
}

export function statusColor(status: CertificateStatus): string {
  return statusMeta[status].color;
}

export function statusTone(status: CertificateStatus): StatusTone {
  return statusMeta[status].tone;
}

export function statusDescription(status: CertificateStatus): string {
  return statusMeta[status].description;
}

export function verificationVerdict(valid: boolean, status?: CertificateStatus): string {
  if (status === "revoked") return "Credencial revocada";
  if (status === "pending") return "Credencial pendiente";
  if (valid && status === "active") return "Credencial válida";
  return "Credencial no verificada";
}
