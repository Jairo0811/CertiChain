import { FormEvent, useState } from "react";

type Verification = {
  valid: boolean;
  certificate?: {
    id: string;
    blockchainId?: string;
    studentName: string;
    title: string;
    institution: string;
    issuedAt: string;
    status: string;
  };
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean;
    blockchain: unknown;
  };
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(date);
}

export function PublicVerify() {
  const params = new URLSearchParams(window.location.search);
  const [certificateId, setCertificateId] = useState(params.get("id") ?? "");
  const [hash, setHash] = useState(params.get("hash") ?? "");
  const [result, setResult] = useState<Verification | null>(null);
  const [loading, setLoading] = useState(false);

  async function verify(event: FormEvent) {
    event.preventDefault();
    setLoading(true);
    try {
      const response = await fetch(
        `${API_URL}/api/verify/${encodeURIComponent(certificateId.trim())}?hash=${encodeURIComponent(hash.trim())}`,
      );
      const body = (await response.json()) as Verification;
      setResult(body);

      const next = new URL(window.location.href);
      next.searchParams.set("id", certificateId.trim());
      next.searchParams.set("hash", hash.trim());
      window.history.replaceState({}, "", next);
    } catch {
      setResult({ valid: false, error: "No fue posible completar la verificación." });
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="public-shell">
      <header className="public-header">
        <a href="/verify" className="brand-lockup public-brand">
          <div className="brand-mark small">CC</div>
          <div>
            <strong>CertiChain</strong>
            <span>Verified. Immutable. Trusted.</span>
          </div>
        </a>
        <a href="/" className="institutional-link">Acceso institucional</a>
      </header>

      <section className="public-verify-workspace">
        <article className="public-verify-intro">
          <p className="eyebrow">VERIFICACIÓN PÚBLICA</p>
          <h1>Comprueba una credencial académica.</h1>
          <p className="public-lead">
            Valida integridad, estado y autenticidad sin crear una cuenta ni iniciar sesión.
          </p>

          <div className="trust-list">
            <div><span>01</span><strong>Integridad criptográfica</strong><small>El hash SHA-256 debe coincidir con la evidencia registrada.</small></div>
            <div><span>02</span><strong>Estado verificable</strong><small>Confirma si la credencial está vigente, pendiente o revocada.</small></div>
            <div><span>03</span><strong>Privacidad por diseño</strong><small>Los datos personales completos permanecen fuera de una blockchain pública.</small></div>
          </div>
        </article>

        <article className="panel public-verify-panel">
          <div className="public-panel-heading">
            <div>
              <p className="eyebrow">VALIDAR CREDENCIAL</p>
              <h2>Verificador CertiChain</h2>
            </div>
            <span className="secure-pill">● Conexión local segura</span>
          </div>

          <form className="form-grid" onSubmit={verify}>
            <label>
              ID o Blockchain ID
              <input
                value={certificateId}
                onChange={(event) => setCertificateId(event.target.value)}
                placeholder="Identificador de la credencial"
                required
              />
            </label>
            <label>
              SHA-256
              <input
                value={hash}
                onChange={(event) => setHash(event.target.value)}
                placeholder="0x + 64 caracteres hexadecimales"
                required
              />
            </label>
            <button type="submit" disabled={loading}>{loading ? "Verificando..." : "Verificar credencial"}</button>
          </form>

          {!result && (
            <div className="verification-placeholder">
              <div className="verification-placeholder-icon">⌁</div>
              <strong>Esperando una credencial</strong>
              <span>Introduce el ID y el hash SHA-256 para consultar la evidencia registrada.</span>
            </div>
          )}

          {result && (
            <div className={`verification-result ${result.valid ? "valid" : "invalid"}`}>
              <div className="verification-result-heading">
                <div className="verification-icon">{result.valid ? "✓" : "✕"}</div>
                <div>
                  <p className="eyebrow">RESULTADO</p>
                  <h2>{result.valid ? "Credencial válida" : "Credencial no verificada"}</h2>
                </div>
              </div>

              {result.certificate && (
                <div className="public-credential-summary">
                  <span>Título<strong>{result.certificate.title}</strong></span>
                  <span>Estudiante<strong>{result.certificate.studentName}</strong></span>
                  <span>Institución<strong>{result.certificate.institution}</strong></span>
                  <span>Fecha de emisión<strong>{formatDate(result.certificate.issuedAt)}</strong></span>
                  <span>Estado<strong>{result.certificate.status}</strong></span>
                  <span>ID<strong className="mono">{result.certificate.blockchainId ?? result.certificate.id}</strong></span>
                </div>
              )}

              {result.checks && (
                <div className="verification-checks">
                  <span className={result.checks.existsOffChain ? "ok" : "fail"}>Registro off-chain</span>
                  <span className={result.checks.hashMatches ? "ok" : "fail"}>Hash SHA-256</span>
                  <span className="neutral">Blockchain {result.checks.blockchain ? "consultada" : "no configurada"}</span>
                </div>
              )}

              {result.error && <p className="verification-error">{result.error}</p>}
            </div>
          )}
        </article>
      </section>

      <footer className="public-footer">
        <span>CertiChain · Sistema académico de credenciales verificables</span>
        <span>Verify once. Trust anywhere.</span>
      </footer>
    </main>
  );
}
