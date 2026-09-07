import { PropsWithChildren, useCallback, useEffect, useMemo, useState } from "react";

type CertificateStatus = "pending" | "active" | "revoked";

type Verification = {
  valid: boolean;
  certificate?: {
    id: string;
    blockchainId?: string;
    studentName: string;
    title: string;
    institution: string;
    issuedAt: string;
    status: CertificateStatus;
  };
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean;
    blockchain: unknown;
    statusManagedByBlockchain?: boolean;
  };
  error?: string;
};

type EvidenceLookup = {
  documentHash: string;
};

type ValidationState = {
  id: string;
  loading: boolean;
  result?: Verification;
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function statusLabel(status?: CertificateStatus) {
  if (status === "active") return "Vigente";
  if (status === "revoked") return "Revocada";
  if (status === "pending") return "Pendiente";
  return "No verificada";
}

export function AdminValidationBridge({ children }: PropsWithChildren) {
  const [validation, setValidation] = useState<ValidationState | null>(null);
  const [statusDraft, setStatusDraft] = useState<CertificateStatus>("pending");
  const [changingStatus, setChangingStatus] = useState(false);

  const validate = useCallback(async (id: string) => {
    setValidation({ id, loading: true });

    try {
      const evidenceResponse = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(id)}/evidence`,
      );
      const evidenceBody = await evidenceResponse.json();
      if (!evidenceResponse.ok) {
        throw new Error(evidenceBody.error ?? "No fue posible localizar la evidencia");
      }

      const evidence = evidenceBody as EvidenceLookup;
      const verifyResponse = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(id)}?hash=${encodeURIComponent(evidence.documentHash)}`,
      );
      const result = (await verifyResponse.json()) as Verification;
      if (!verifyResponse.ok) {
        throw new Error(result.error ?? "No fue posible validar la credencial");
      }

      if (result.certificate) setStatusDraft(result.certificate.status);
      setValidation({ id, loading: false, result });
    } catch (error) {
      setValidation({
        id,
        loading: false,
        error: (error as Error).message,
      });
    }
  }, []);

  async function changeStatus() {
    const certificate = validation?.result?.certificate;
    if (!certificate || changingStatus) return;

    if (validation?.result?.checks?.statusManagedByBlockchain) return;

    const token = sessionStorage.getItem("certichain-token");
    if (!token) {
      setValidation((current) => current ? { ...current, error: "La sesión institucional expiró." } : current);
      return;
    }

    if (statusDraft === certificate.status) return;

    if (
      certificate.status === "revoked" &&
      statusDraft !== "revoked" &&
      !window.confirm("Esta credencial está revocada. ¿Deseas cambiar su estado en este entorno off-chain/local?")
    ) {
      return;
    }

    setChangingStatus(true);
    try {
      const response = await fetch(
        `${API_URL}/api/certificates/${encodeURIComponent(certificate.id)}/status`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
          body: JSON.stringify({ status: statusDraft }),
        },
      );
      const body = await response.json();
      if (!response.ok) throw new Error(body.error ?? "No fue posible cambiar el estado");
      await validate(validation.id);
    } catch (error) {
      setValidation((current) => current ? { ...current, error: (error as Error).message } : current);
    } finally {
      setChangingStatus(false);
    }
  }

  useEffect(() => {
    const originalOpen = window.open;

    const interceptedOpen: typeof window.open = (url, target, features) => {
      if (url) {
        const parsed = new URL(url.toString(), window.location.origin);
        const id = parsed.searchParams.get("id")?.trim();
        if (
          parsed.origin === window.location.origin &&
          parsed.pathname === "/verify" &&
          parsed.searchParams.get("autoverify") === "1" &&
          id
        ) {
          void validate(id);
          return null;
        }
      }

      return originalOpen.call(window, url, target, features);
    };

    window.open = interceptedOpen;
    return () => {
      window.open = originalOpen;
    };
  }, [validate]);

  const verdict = useMemo(() => {
    const result = validation?.result;
    if (!result) return null;
    if (result.valid) return "Credencial válida";
    if (result.certificate?.status === "revoked") return "Credencial revocada";
    if (result.certificate?.status === "pending") return "Credencial pendiente";
    return "Credencial no verificada";
  }, [validation]);

  const statusManagedByBlockchain = Boolean(validation?.result?.checks?.statusManagedByBlockchain);
  const currentStatus = validation?.result?.certificate?.status;

  return (
    <>
      {children}
      {validation && (
        <div className="modal-backdrop" onClick={() => setValidation(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setValidation(null)}>×</button>
            <p className="eyebrow">VALIDACIÓN CRIPTOGRÁFICA</p>
            <h2>{validation.loading ? "Validando credencial..." : verdict ?? "Resultado"}</h2>

            {validation.loading && (
              <p className="muted">
                CertiChain está comprobando registro, SHA-256 y estado actual sin salir del portal.
              </p>
            )}

            {validation.error && <p className="notice">{validation.error}</p>}

            {validation.result && (
              <>
                <div className={`verification-result ${validation.result.valid ? "valid" : "invalid"}`}>
                  <div className="verification-result-heading">
                    <div className="verification-icon">{validation.result.valid ? "✓" : "!"}</div>
                    <div>
                      <p className="eyebrow">RESULTADO</p>
                      <h2>{verdict}</h2>
                    </div>
                  </div>
                </div>

                {validation.result.certificate && (
                  <div className="credential-summary">
                    <span>
                      Estudiante
                      <strong>{validation.result.certificate.studentName}</strong>
                    </span>
                    <span>
                      Título
                      <strong>{validation.result.certificate.title}</strong>
                    </span>
                    <span>
                      Institución
                      <strong>{validation.result.certificate.institution}</strong>
                    </span>
                    <span>
                      Estado
                      <strong className={`status ${validation.result.certificate.status}`}>
                        {statusLabel(validation.result.certificate.status)}
                      </strong>
                    </span>
                    <span>
                      ID / Blockchain ID
                      <strong className="mono">
                        {validation.result.certificate.blockchainId ?? validation.result.certificate.id}
                      </strong>
                    </span>
                  </div>
                )}

                {validation.result.checks && (
                  <div className="verification-checks">
                    <span className={validation.result.checks.existsOffChain ? "ok" : "fail"}>
                      {validation.result.checks.existsOffChain ? "✓" : "✕"} Registro off-chain
                    </span>
                    <span className={validation.result.checks.hashMatches ? "ok" : "fail"}>
                      {validation.result.checks.hashMatches ? "✓" : "✕"} Hash SHA-256
                    </span>
                    <span className="neutral">
                      Blockchain {validation.result.checks.blockchain ? "consultada" : "no configurada"}
                    </span>
                  </div>
                )}

                {validation.result.certificate && (
                  <section className="validation-status-manager">
                    <p className="eyebrow">GESTIÓN DE ESTADO</p>
                    <label>
                      Estado de la credencial
                      <select
                        value={statusDraft}
                        disabled={statusManagedByBlockchain || changingStatus}
                        onChange={(event) => setStatusDraft(event.target.value as CertificateStatus)}
                      >
                        <option value="pending">Pendiente</option>
                        <option value="active">Vigente</option>
                        <option value="revoked">Revocado</option>
                      </select>
                    </label>
                    <button
                      type="button"
                      disabled={statusManagedByBlockchain || changingStatus || statusDraft === currentStatus}
                      onClick={() => void changeStatus()}
                    >
                      {changingStatus ? "Actualizando..." : "Actualizar estado"}
                    </button>
                    <small>
                      {statusManagedByBlockchain
                        ? "El estado está controlado por blockchain y no admite cambios manuales."
                        : "Disponible para credenciales locales/off-chain. Cada cambio queda registrado en auditoría."}
                    </small>
                  </section>
                )}

                {validation.result.error && (
                  <p className="verification-error">{validation.result.error}</p>
                )}
              </>
            )}
          </aside>
        </div>
      )}
    </>
  );
}
