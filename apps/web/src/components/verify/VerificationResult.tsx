import { BLOCKCHAIN_CHECK_COPY, formatDate, formatDateTime, MODE_DESCRIPTION, OUTCOME_COPY, shortHash, STATUS_LABEL } from "../../lib/format";
import type { Verification } from "../../types";
import { ModeBadge } from "../ui/Badges";
import { Icon } from "../ui/Icon";

type CheckState = "ok" | "fail" | "skip" | "warn";

const STATE_ICON: Record<CheckState, "check" | "cross" | "minus" | "alert"> = {
  ok: "check",
  fail: "cross",
  skip: "minus",
  warn: "alert",
};
const STATE_TEXT: Record<CheckState, string> = {
  ok: "Superada",
  fail: "Fallida",
  skip: "No evaluada",
  warn: "Sin confirmar",
};

interface Check {
  key: string;
  title: string;
  detail: string;
  state: CheckState;
  stateText?: string;
}

/** Turns the API result into separate, honest rows: what was checked and what was not. */
export type HashSource = { kind: "file"; name: string } | { kind: "link" };

export function buildChecks(result: Verification, source?: HashSource): Check[] {
  const { checks, certificate } = result;
  const registryState: CheckState = checks.registryStatus === "active" ? "ok" : checks.registryStatus === "pending" ? "warn" : "fail";

  const integrity: Check =
    checks.integrity === "not_evaluated"
      ? {
          key: "integrity",
          title: "Integridad del documento",
          detail: "No se presentó ningún PDF. Esta consulta no dice nada sobre la autenticidad de un archivo concreto.",
          state: "skip",
        }
      : source?.kind === "link"
        ? {
            key: "integrity",
            title: "SHA-256 del enlace",
            detail:
              checks.integrity === "match"
                ? "El hash incluido en este enlace heredado coincide con el registrado. Esto valida el enlace, no un archivo: para comprobar un PDF, selecciónalo arriba."
                : "El hash incluido en este enlace no coincide con el registrado. El enlace pudo haber sido alterado.",
            state: checks.integrity === "match" ? "warn" : "fail",
          }
        : checks.integrity === "match"
          ? {
              key: "integrity",
              title: "Integridad del documento",
              detail: `${source ? `«${source.name}»` : "El PDF presentado"} produce exactamente el SHA-256 registrado. El cálculo se hizo en tu navegador.`,
              state: "ok",
            }
          : {
              key: "integrity",
              title: "Integridad del documento",
              detail: `${source ? `«${source.name}»` : "El PDF presentado"} no produce el SHA-256 registrado: es otro archivo o fue modificado.`,
              state: "fail",
            };

  const chain = BLOCKCHAIN_CHECK_COPY[checks.blockchainStatus];

  return [
    {
      key: "registry",
      title: "Registro de CertiChain",
      detail: `Existe en el registro institucional con estado «${STATUS_LABEL[checks.registryStatus]}»${
        certificate.revokedAt ? ` desde el ${formatDate(certificate.revokedAt)}` : ""
      }.`,
      state: registryState,
      stateText: STATUS_LABEL[checks.registryStatus],
    },
    integrity,
    {
      key: "blockchain",
      title: "Ancla en blockchain",
      detail: chain.label + ".",
      state: chain.state,
    },
  ];
}

export function VerificationResult({ result, source }: { result: Verification; source?: HashSource }) {
  const copy = OUTCOME_COPY[result.outcome];
  const checks = buildChecks(result, source);
  const { certificate } = result;

  return (
    <section className={`verdict tone-${copy.tone}`} aria-labelledby="verdict-title">
      <div className="verdict-seal">
        <span className="seal-mark" aria-hidden="true">
          <Icon name={copy.tone === "success" ? "check" : copy.tone === "danger" ? "cross" : "alert"} size={26} />
        </span>
        <div>
          <h2 id="verdict-title" className="verdict-title">
            {copy.title}
          </h2>
          <p className="verdict-body">{copy.body}</p>
        </div>
      </div>

      <dl className="credential-sheet">
        <div className="sheet-title">
          <dt className="visually-hidden">Título</dt>
          <dd>{certificate.title}</dd>
        </div>
        <div>
          <dt>Institución</dt>
          <dd>{certificate.institution}</dd>
        </div>
        <div>
          <dt>Titular</dt>
          <dd>
            {certificate.studentName}
            <span className="dd-note">Nombre parcialmente oculto por privacidad</span>
          </dd>
        </div>
        <div>
          <dt>Fecha de emisión</dt>
          <dd>{formatDate(certificate.issuedAt, true)}</dd>
        </div>
        <div>
          <dt>Modalidad de evidencia</dt>
          <dd>
            <ModeBadge mode={result.evidenceMode} />
            <span className="dd-note">{MODE_DESCRIPTION[result.evidenceMode]}</span>
          </dd>
        </div>
        <div className="sheet-wide">
          <dt>Identificador</dt>
          <dd className="mono" title={certificate.blockchainId ?? certificate.id}>
            {shortHash(certificate.blockchainId ?? certificate.id, 14, 10)}
          </dd>
        </div>
      </dl>

      <ol className="ledger" aria-label="Comprobaciones realizadas">
        {checks.map((check) => (
          <li key={check.key} className={`ledger-row state-${check.state}`}>
            <span className="ledger-icon">
              <Icon name={STATE_ICON[check.state]} size={16} />
            </span>
            <div>
              <strong>{check.title}</strong>
              <p>{check.detail}</p>
            </div>
            <span className="ledger-state">{check.stateText ?? STATE_TEXT[check.state]}</span>
          </li>
        ))}
      </ol>

      <p className="verdict-footnote">
        Consulta realizada el {formatDateTime(result.verifiedAt)}; el resultado refleja el estado en ese momento.
      </p>
    </section>
  );
}
