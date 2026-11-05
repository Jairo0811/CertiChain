import { useEffect, useRef, useState } from "react";
import { canDelete, canGeneratePdf, needsAnchoring } from "../../hooks/useCertificateActions";
import { useAsync } from "../../hooks/useAsync";
import { messageFor } from "../../lib/api";
import { ACTION_LABEL, formatDate, formatDateTime, MODE_DESCRIPTION, publicId, STATUS_LABEL } from "../../lib/format";
import { certificateService, verificationService } from "../../services";
import type { Certificate, CertificateStatus, Verification } from "../../types";
import { ModeBadge, StatusBadge, SYNC_LABEL } from "../ui/Badges";
import { Dialog } from "../ui/Dialog";
import { ErrorState, Spinner } from "../ui/Feedback";
import { Icon } from "../ui/Icon";
import { useToast } from "../ui/Toast";
import { VerificationResult } from "../verify/VerificationResult";

function CopyValue({ value, label }: { value: string; label: string }) {
  const toast = useToast();
  return (
    <span className="copy-value">
      <span className="mono">{value}</span>
      <button
        type="button"
        className="icon-button"
        aria-label={`Copiar ${label}`}
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(
            () => toast(`${label} copiado.`, "info"),
            () => toast("No se pudo copiar al portapapeles.", "error"),
          );
        }}
      >
        <Icon name="copy" size={16} />
      </button>
    </span>
  );
}

export function CertificateDrawer({
  id,
  validateOnOpen,
  refreshKey,
  isAdmin,
  canManage,
  working,
  onClose,
  onChanged,
  onDownload,
  onAnchor,
  onRevoke,
  onDelete,
}: {
  id: string;
  validateOnOpen?: boolean;
  refreshKey: number;
  isAdmin: boolean;
  canManage: boolean;
  working: string | null;
  onClose: () => void;
  onChanged: (certificate: Certificate) => void;
  onDownload: (certificate: Certificate) => void;
  onAnchor: (certificate: Certificate) => void;
  onRevoke: (certificate: Certificate) => void;
  onDelete: (certificate: Certificate) => void;
}) {
  const toast = useToast();
  const detail = useAsync(() => certificateService.get(id), [id, refreshKey]);
  const [verification, setVerification] = useState<Verification | null>(null);
  const [verifying, setVerifying] = useState(false);
  const [verifyError, setVerifyError] = useState("");
  const [statusDraft, setStatusDraft] = useState<CertificateStatus>("pending");
  const [statusReason, setStatusReason] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const autoValidated = useRef(false);
  const certificate = detail.data;

  useEffect(() => {
    if (certificate) setStatusDraft(certificate.status);
  }, [certificate]);

  async function validate(target: Certificate) {
    setVerifying(true);
    setVerifyError("");
    try {
      setVerification(await verificationService.byId(publicId(target)));
    } catch (reason) {
      setVerifyError(messageFor(reason, "No fue posible validar la credencial."));
    } finally {
      setVerifying(false);
    }
  }

  useEffect(() => {
    if (validateOnOpen && certificate && !autoValidated.current) {
      autoValidated.current = true;
      void validate(certificate);
    }
  }, [validateOnOpen, certificate]);

  async function applyStatus() {
    if (!certificate) return;
    setStatusBusy(true);
    try {
      const updated = await certificateService.changeStatus(certificate.id, statusDraft, statusReason.trim() || undefined);
      toast(`Estado actualizado a «${STATUS_LABEL[updated.status]}». El cambio quedó auditado.`);
      setStatusReason("");
      onChanged(updated);
      if (verification) void validate(updated);
    } catch (reason) {
      toast(messageFor(reason, "No fue posible cambiar el estado."), "error");
    } finally {
      setStatusBusy(false);
    }
  }

  const leavingRevoked = certificate?.status === "revoked" && statusDraft !== "revoked";

  return (
    <Dialog
      variant="drawer"
      size="lg"
      onClose={onClose}
      title={certificate ? certificate.title : "Detalle de la credencial"}
      description={certificate ? `${certificate.studentName}, ${certificate.institution}` : undefined}
      footer={
        certificate && (
          <div className="drawer-actions">
            {canGeneratePdf(certificate) && (
              <button type="button" className="button secondary" onClick={() => onDownload(certificate)} disabled={working === `pdf:${certificate.id}`}>
                <Icon name="download" size={16} /> {certificate.documentAvailable ? "Descargar PDF" : "Generar PDF"}
              </button>
            )}
            {canManage && needsAnchoring(certificate) && (
              <button type="button" className="button secondary" onClick={() => onAnchor(certificate)} disabled={working === `anchor:${certificate.id}`}>
                <Icon name="refresh" size={16} /> Sincronizar con blockchain
              </button>
            )}
            <span className="spacer" />
            {canManage && certificate.status !== "revoked" && !needsAnchoring(certificate) && (
              <button type="button" className="button danger-ghost" onClick={() => onRevoke(certificate)}>
                <Icon name="revoke" size={16} /> Revocar
              </button>
            )}
            {isAdmin && canDelete(certificate) && (
              <button type="button" className="button danger-ghost" onClick={() => onDelete(certificate)}>
                <Icon name="trash" size={16} /> Eliminar
              </button>
            )}
          </div>
        )
      }
    >
      {detail.error ? (
        <ErrorState message={messageFor(detail.error, "No fue posible cargar la credencial.")} onRetry={detail.reload} />
      ) : !certificate ? (
        <div className="loading-block">
          <Spinner label="Cargando credencial" />
        </div>
      ) : (
        <div className="drawer-content">
          <div className="badge-row">
            <StatusBadge status={certificate.status} />
            <ModeBadge mode={certificate.evidenceMode} />
            {certificate.chainSyncStatus && certificate.chainSyncStatus !== "not_requested" && (
              <span className={`badge sync-${certificate.chainSyncStatus}`}>{SYNC_LABEL[certificate.chainSyncStatus]}</span>
            )}
          </div>
          <p className="muted small">{MODE_DESCRIPTION[certificate.evidenceMode]}</p>

          {certificate.chainSyncStatus === "failed" && (
            <p className="callout warning">
              El anclaje no se completó{certificate.chainError ? ` (${certificate.chainError})` : ""}. La credencial sigue pendiente y no se envió
              ninguna transacción duplicada. Usa «Sincronizar con blockchain» cuando la red esté disponible.
            </p>
          )}
          {certificate.chainSyncStatus === "submitted" && (
            <p className="callout info">
              La transacción fue enviada y espera confirmación. Sincronizar consulta su recibo; nunca la reenvía.
            </p>
          )}

          <section aria-labelledby="facts-title">
            <h3 id="facts-title" className="section-title">Datos de la credencial</h3>
            <dl className="facts">
              <div>
                <dt>Titular</dt>
                <dd>{certificate.studentName}</dd>
              </div>
              <div>
                <dt>Fecha de emisión</dt>
                <dd>{formatDate(certificate.issuedAt, true)}</dd>
              </div>
              <div>
                <dt>Registrada</dt>
                <dd>{formatDateTime(certificate.createdAt)} por {certificate.issuerEmail}</dd>
              </div>
              {certificate.revokedAt && (
                <div>
                  <dt>Revocada</dt>
                  <dd>{formatDateTime(certificate.revokedAt)}</dd>
                </div>
              )}
              <div className="wide">
                <dt>Identificador público</dt>
                <dd>
                  <CopyValue value={publicId(certificate)} label="Identificador" />
                </dd>
              </div>
              <div className="wide">
                <dt>{certificate.evidenceMode === "on-chain" ? "Wallet del titular" : "Dirección asociada"}</dt>
                <dd>
                  <span className="mono">{certificate.studentWallet}</span>
                  {certificate.evidenceMode !== "on-chain" && (
                    <span className="dd-note">
                      Si no se indicó una wallet al emitir, es un identificador técnico aleatorio sin clave privada: no la controla el estudiante.
                    </span>
                  )}
                </dd>
              </div>
            </dl>
          </section>

          <section aria-labelledby="evidence-title">
            <h3 id="evidence-title" className="section-title">Evidencia</h3>
            <dl className="facts">
              <div className="wide">
                <dt>SHA-256 del PDF original</dt>
                <dd>
                  <CopyValue value={certificate.documentHash} label="SHA-256" />
                </dd>
              </div>
              <div>
                <dt>PDF cifrado (AES-256-GCM)</dt>
                <dd>{certificate.documentAvailable ? "Disponible en este entorno" : "No disponible en este entorno"}</dd>
              </div>
              {certificate.chainTxHash && (
                <div className="wide">
                  <dt>Transacción de emisión</dt>
                  <dd>
                    <CopyValue value={certificate.chainTxHash} label="Hash de transacción" />
                  </dd>
                </div>
              )}
              {certificate.chainRevokeTxHash && (
                <div className="wide">
                  <dt>Transacción de revocación</dt>
                  <dd>
                    <CopyValue value={certificate.chainRevokeTxHash} label="Hash de revocación" />
                  </dd>
                </div>
              )}
            </dl>
          </section>

          <section aria-labelledby="validation-title" className="validation-section">
            <div className="section-head">
              <h3 id="validation-title" className="section-title">Validación</h3>
              <button type="button" className="button ghost small" onClick={() => void validate(certificate)} disabled={verifying}>
                <Icon name="verify" size={16} /> {verifying ? "Validando…" : verification ? "Validar de nuevo" : "Validar ahora"}
              </button>
            </div>
            <p className="muted small">
              Ejecuta la misma consulta que un verificador externo por identificador: registro y blockchain. No compara ningún PDF; para eso
              usa el verificador público con el archivo.
            </p>
            <div aria-live="polite">
              {verifyError && (
                <p className="inline-error" role="alert">
                  {verifyError}
                </p>
              )}
              {verification && <VerificationResult result={verification} />}
            </div>
          </section>

          {isAdmin && (
            <section aria-labelledby="status-manager-title" className="status-manager">
              <h3 id="status-manager-title" className="section-title">Estado off-chain</h3>
              {certificate.statusManagedByBlockchain ? (
                <p className="muted small">
                  <Icon name="lock" size={14} /> El estado de esta credencial lo gobierna el contrato en blockchain. Solo puede revocarse, de forma
                  permanente.
                </p>
              ) : (
                <>
                  <div className="status-form">
                    <label className="field">
                      <span className="field-label">Nuevo estado</span>
                      <select value={statusDraft} onChange={(event) => setStatusDraft(event.target.value as CertificateStatus)} disabled={statusBusy}>
                        <option value="pending">Pendiente</option>
                        <option value="active">Vigente</option>
                        <option value="revoked">Revocada</option>
                      </select>
                    </label>
                    {leavingRevoked && (
                      <label className="field">
                        <span className="field-label">Motivo de la reactivación</span>
                        <input value={statusReason} onChange={(event) => setStatusReason(event.target.value)} maxLength={500} placeholder="Obligatorio, mínimo 5 caracteres" />
                      </label>
                    )}
                    <button
                      type="button"
                      className="button secondary"
                      onClick={() => void applyStatus()}
                      disabled={statusBusy || statusDraft === certificate.status || (leavingRevoked && statusReason.trim().length < 5)}
                    >
                      {statusBusy ? "Aplicando…" : "Aplicar estado"}
                    </button>
                  </div>
                  <p className="muted small">
                    Solo para credenciales {certificate.evidenceMode === "demo" ? "demo" : "off-chain"}. Cada cambio queda en la auditoría con su autor y
                    motivo.
                  </p>
                </>
              )}
            </section>
          )}

          <section aria-labelledby="history-title">
            <h3 id="history-title" className="section-title">Historial de auditoría</h3>
            {certificate.history.length === 0 ? (
              <p className="muted small">Sin eventos registrados para esta credencial.</p>
            ) : (
              <ol className="timeline">
                {certificate.history
                  .filter((event) => event.action !== "certificate.verify")
                  .slice(0, 12)
                  .map((event) => (
                    <li key={event.id}>
                      <time dateTime={event.timestamp}>{formatDateTime(event.timestamp)}</time>
                      <span>
                        <strong>{ACTION_LABEL[event.action] ?? event.action}</strong>
                        <span className="muted"> por {event.actor}</span>
                        {typeof event.metadata?.reason === "string" && <span className="timeline-note">Motivo: {event.metadata.reason}</span>}
                      </span>
                    </li>
                  ))}
              </ol>
            )}
            {certificate.history.some((event) => event.action === "certificate.verify") && (
              <p className="muted small">
                {certificate.history.filter((event) => event.action === "certificate.verify").length} verificaciones públicas recientes registradas.
              </p>
            )}
          </section>
        </div>
      )}
    </Dialog>
  );
}
