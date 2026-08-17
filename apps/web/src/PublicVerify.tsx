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
    <main className="auth-shell">
      <section className="auth-card public-verify-card">
        <div className="brand-mark">CC</div>
        <p className="eyebrow">PUBLIC CREDENTIAL VERIFICATION</p>
        <h1>Verificar con CertiChain</h1>
        <p className="muted">Comprueba integridad, estado y autenticidad de una credencial académica sin iniciar sesión.</p>

        <form className="form-grid" onSubmit={verify}>
          <label>ID o Blockchain ID<input value={certificateId} onChange={(event) => setCertificateId(event.target.value)} required /></label>
          <label>SHA-256<input value={hash} onChange={(event) => setHash(event.target.value)} placeholder="0x + 64 hex" required /></label>
          <button type="submit" disabled={loading}>{loading ? "Verificando..." : "Verificar credencial"}</button>
        </form>

        {result && (
          <div className={`verification ${result.valid ? "valid" : "invalid"}`}>
            <strong>{result.valid ? "✓ Credencial válida" : "✕ Credencial no verificada"}</strong>
            {result.certificate && (
              <>
                <span>{result.certificate.title}</span>
                <span>{result.certificate.institution}</span>
                <span>{result.certificate.studentName}</span>
                <span>Estado: {result.certificate.status}</span>
                <span className="mono">{result.certificate.blockchainId ?? result.certificate.id}</span>
              </>
            )}
            {result.error && <span>{result.error}</span>}
          </div>
        )}

        <a href="/" className="back-link">Acceso institucional</a>
      </section>
    </main>
  );
}
