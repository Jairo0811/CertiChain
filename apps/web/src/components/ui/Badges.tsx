import { MODE_DESCRIPTION, MODE_LABEL, STATUS_LABEL } from "../../lib/format";
import type { CertificateStatus, ChainSyncStatus, EvidenceMode } from "../../types";

export function StatusBadge({ status }: { status: CertificateStatus }) {
  return (
    <span className={`badge status-${status}`}>
      <span className="badge-dot" aria-hidden="true" />
      {STATUS_LABEL[status]}
    </span>
  );
}

export function ModeBadge({ mode }: { mode: EvidenceMode }) {
  return (
    <span className={`badge mode-${mode}`} title={MODE_DESCRIPTION[mode]}>
      {MODE_LABEL[mode]}
    </span>
  );
}

const SYNC_LABEL: Record<ChainSyncStatus, string> = {
  not_requested: "Sin anclaje",
  submitting: "Enviando a blockchain",
  submitted: "Confirmación pendiente",
  anchored: "Anclada",
  failed: "Anclaje fallido",
};

export function SyncBadge({ status }: { status?: ChainSyncStatus }) {
  if (!status || status === "not_requested" || status === "anchored") return null;
  return <span className={`badge sync-${status}`}>{SYNC_LABEL[status]}</span>;
}

export { SYNC_LABEL };
