import { FormEvent, useRef, useState } from "react";
import { SyncBadge, StatusBadge } from "../components/ui/Badges";
import { Spinner } from "../components/ui/Feedback";
import { Field } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { useToast } from "../components/ui/Toast";
import { useAsync } from "../hooks/useAsync";
import { ApiError, messageFor } from "../lib/api";
import { saveBlob } from "../lib/download";
import { pdfFilename, publicId, verifyUrl } from "../lib/format";
import { certificateService, systemService } from "../services";
import type { Certificate } from "../types";

type Fields = "studentName" | "studentWallet" | "title" | "institution" | "issuedAt";
type Values = Record<Fields, string>;

const EMPTY: Values = { studentName: "", studentWallet: "", title: "", institution: "", issuedAt: "" };

function today(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
}

export function validateIssue(values: Values, walletRequired: boolean): Partial<Record<Fields, string>> {
  const errors: Partial<Record<Fields, string>> = {};
  const text = (value: string, min: number, max: number) => {
    const length = value.trim().length;
    return length >= min && length <= max;
  };
  if (!text(values.studentName, 2, 160)) errors.studentName = "Introduce el nombre completo del titular (2–160 caracteres).";
  if (!text(values.title, 2, 200)) errors.title = "Introduce el título académico (2–200 caracteres).";
  if (!text(values.institution, 2, 200)) errors.institution = "Introduce la institución emisora (2–200 caracteres).";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(values.issuedAt)) errors.issuedAt = "Selecciona la fecha de emisión.";
  else if (values.issuedAt > today()) errors.issuedAt = "La fecha de emisión no puede ser futura.";
  const wallet = values.studentWallet.trim();
  if (walletRequired && !wallet) errors.studentWallet = "En modo blockchain la wallet del titular es obligatoria.";
  else if (wallet && !/^0x[a-fA-F0-9]{40}$/.test(wallet)) errors.studentWallet = "Debe ser una dirección EVM: 0x seguido de 40 caracteres hexadecimales.";
  else if (wallet && /^0x0{40}$/.test(wallet)) errors.studentWallet = "La dirección cero no puede recibir credenciales.";
  return errors;
}

const SERVER_FIELD_MESSAGES: Partial<Record<Fields, string>> = {
  studentWallet: "La dirección no es válida o su checksum EIP-55 no coincide. Cópiala de nuevo desde la wallet del titular.",
  issuedAt: "La fecha de emisión no es válida.",
};

export function IssuePage({ onOpenCertificate }: { onOpenCertificate: (id: string) => void }) {
  const toast = useToast();
  const health = useAsync(() => systemService.health(), []);
  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Fields, boolean>>>({});
  const [serverErrors, setServerErrors] = useState<Partial<Record<Fields, string>>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [issued, setIssued] = useState<Certificate | null>(null);
  const inFlight = useRef(false);

  const onChain = health.data?.blockchainConfigured === true;
  const errors = { ...validateIssue(values, onChain), ...serverErrors };

  function update(field: Fields, value: string) {
    setValues((current) => ({ ...current, [field]: value }));
    setServerErrors((current) => ({ ...current, [field]: undefined }));
  }

  function bind(field: Fields) {
    return {
      name: field,
      value: values[field],
      onChange: (event: { target: { value: string } }) => update(field, event.target.value),
      onBlur: () => setTouched((current) => ({ ...current, [field]: true })),
    };
  }

  const errorFor = (field: Fields) => (touched[field] ? errors[field] : undefined);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({ studentName: true, studentWallet: true, title: true, institution: true, issuedAt: true });
    if (Object.values(validateIssue(values, onChain)).some(Boolean)) return;
    // Synchronous guard: prevents duplicate submissions before React re-renders the disabled button.
    if (inFlight.current) return;
    inFlight.current = true;
    setBusy(true);
    setError("");
    try {
      const certificate = await certificateService.issue({
        studentName: values.studentName.trim(),
        title: values.title.trim(),
        institution: values.institution.trim(),
        issuedAt: values.issuedAt,
        ...(values.studentWallet.trim() ? { studentWallet: values.studentWallet.trim() } : {}),
      });
      setIssued(certificate);
      setValues(EMPTY);
      setTouched({});
      toast(
        certificate.chainSyncStatus === "anchored"
          ? "Certificado emitido y anclado en blockchain."
          : certificate.chainSyncStatus === "failed" || certificate.chainSyncStatus === "submitted"
            ? "Certificado registrado; el anclaje blockchain quedó pendiente."
            : "Certificado emitido con su PDF y SHA-256.",
        certificate.chainSyncStatus === "failed" ? "info" : "success",
      );
    } catch (reason) {
      if (reason instanceof ApiError && reason.details?.fieldErrors) {
        const mapped: Partial<Record<Fields, string>> = {};
        for (const field of Object.keys(reason.details.fieldErrors) as Fields[]) {
          mapped[field] = SERVER_FIELD_MESSAGES[field] ?? "Revisa este campo.";
        }
        setServerErrors(mapped);
      }
      setError(messageFor(reason, "No fue posible emitir el certificado."));
    } finally {
      inFlight.current = false;
      setBusy(false);
    }
  }

  async function download(certificate: Certificate) {
    try {
      saveBlob(await certificateService.downloadPdf(certificate.id), pdfFilename(certificate));
    } catch (reason) {
      toast(messageFor(reason, "No fue posible descargar el PDF."), "error");
    }
  }

  if (issued) {
    const pendingChain = issued.chainSyncStatus === "failed" || issued.chainSyncStatus === "submitted" || issued.chainSyncStatus === "submitting";
    return (
      <div className="page narrow">
        <section className="panel issued-panel" aria-labelledby="issued-title" tabIndex={-1} ref={(node) => node?.focus()}>
          <span className={`issued-mark ${pendingChain ? "warning" : ""}`} aria-hidden="true">
            <Icon name={pendingChain ? "clock" : "check"} size={24} />
          </span>
          <h2 id="issued-title" className="page-title">
            {pendingChain ? "Certificado registrado, anclaje pendiente" : "Certificado emitido"}
          </h2>
          <p className="muted">
            {issued.title}, {issued.studentName}. {issued.institution}.
          </p>
          <div className="badge-row">
            <StatusBadge status={issued.status} />
            <SyncBadge status={issued.chainSyncStatus} />
          </div>
          <dl className="facts">
            <div className="wide">
              <dt>Identificador público</dt>
              <dd className="mono">{publicId(issued)}</dd>
            </div>
            <div className="wide">
              <dt>SHA-256 del PDF</dt>
              <dd className="mono">{issued.documentHash}</dd>
            </div>
          </dl>
          {pendingChain && (
            <p className="callout warning">
              La credencial quedó guardada como pendiente. No se reenviará ninguna transacción por su cuenta: sincronízala desde su detalle
              cuando la red esté disponible.
            </p>
          )}
          {issued.status === "pending" && !pendingChain && (
            <p className="callout info">
              Credencial off-chain en estado pendiente. Un administrador puede activarla desde su detalle.
            </p>
          )}
          <div className="button-row">
            {issued.documentAvailable && (
              <button type="button" className="button primary" onClick={() => void download(issued)}>
                <Icon name="download" size={16} /> Descargar PDF
              </button>
            )}
            <a className="button secondary" href={verifyUrl(publicId(issued))} target="_blank" rel="noopener noreferrer">
              <Icon name="verify" size={16} /> Abrir en el verificador
            </a>
            <button type="button" className="button ghost" onClick={() => onOpenCertificate(issued.id)}>
              Ver detalle
            </button>
            <button type="button" className="button ghost" onClick={() => setIssued(null)}>
              Emitir otro
            </button>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="page narrow">
      <div className="page-head">
        <div>
          <h2 className="page-title">Emitir certificado</h2>
          <p className="muted">CertiChain genera el PDF, calcula su SHA-256 y lo guarda cifrado con AES-256-GCM.</p>
        </div>
      </div>

      <div className={`mode-banner ${onChain ? "on-chain" : ""}`} role="note">
        {health.loading ? (
          <>
            <Spinner label="Comprobando configuración" /> Comprobando la configuración del entorno…
          </>
        ) : health.error ? (
          <>
            <Icon name="alert" size={16} /> No se pudo leer la configuración del entorno. La API decidirá el modo al emitir.
          </>
        ) : onChain ? (
          <>
            <Icon name="chain" size={16} /> Modo blockchain: la credencial se anclará en el contrato CertificateRegistry y se activará al
            confirmarse la transacción.
          </>
        ) : (
          <>
            <Icon name="database" size={16} /> Modo off-chain: la credencial se registra solo en CertiChain y queda pendiente hasta que un
            administrador la active.
          </>
        )}
      </div>

      <form className="panel form-panel" onSubmit={submit} noValidate aria-busy={busy}>
        <fieldset disabled={busy}>
          <legend className="section-title">Titular</legend>
          <Field label="Nombre completo" error={errorFor("studentName")}>
            {(field) => <input {...field} {...bind("studentName")} autoComplete="off" maxLength={160} placeholder="Ana María Pérez Gómez" />}
          </Field>
          <Field
            label="Wallet del titular"
            optional={!onChain}
            error={errorFor("studentWallet")}
            hint={
              onChain
                ? "Dirección EVM que controla el estudiante. Se registra en el contrato; verifica el checksum antes de emitir."
                : "Si la dejas vacía, CertiChain genera un identificador técnico sin clave privada. No es una wallet del estudiante."
            }
          >
            {(field) => (
              <input {...field} {...bind("studentWallet")} autoComplete="off" spellCheck={false} className="mono" maxLength={42} placeholder="0x…" />
            )}
          </Field>
        </fieldset>

        <fieldset disabled={busy}>
          <legend className="section-title">Credencial</legend>
          <Field label="Título académico" error={errorFor("title")}>
            {(field) => <input {...field} {...bind("title")} autoComplete="off" maxLength={200} placeholder="Ingeniería de Software" />}
          </Field>
          <div className="field-grid">
            <Field label="Institución emisora" error={errorFor("institution")}>
              {(field) => <input {...field} {...bind("institution")} autoComplete="organization" maxLength={200} placeholder="Universidad APEC (UNAPEC)" />}
            </Field>
            <Field label="Fecha de emisión" error={errorFor("issuedAt")}>
              {(field) => <input {...field} {...bind("issuedAt")} type="date" max={today()} />}
            </Field>
          </div>
        </fieldset>

        {error && (
          <p className="inline-error" role="alert">
            {error}
          </p>
        )}

        <div className="form-footer">
          <p className="muted small">
            {onChain ? "La emisión puede tardar mientras se confirma la transacción." : "La emisión tarda unos segundos."}
          </p>
          <button type="submit" className="button primary" disabled={busy} aria-busy={busy}>
            {busy ? (
              <>
                <Spinner label="Emitiendo" /> {onChain ? "Emitiendo y anclando…" : "Emitiendo…"}
              </>
            ) : (
              <>
                <Icon name="issue" size={16} /> Emitir certificado
              </>
            )}
          </button>
        </div>
      </form>
    </div>
  );
}
