import { FormEvent, useEffect, useMemo, useState } from "react";

type Certificate = {
  id: string;
  blockchainId?: string;
  studentName: string;
  title: string;
  institution: string;
  issuedAt: string;
  status: "pending" | "active" | "revoked";
};

type Verification = {
  valid: boolean;
  certificate?: Certificate;
  checks?: {
    existsOffChain: boolean;
    hashMatches: boolean;
    blockchain: unknown;
  };
  error?: string;
};

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("certichain-token") ?? "");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [message, setMessage] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);

  const stats = useMemo(() => ({
    total: certificates.length,
    active: certificates.filter((item) => item.status === "active").length,
    pending: certificates.filter((item) => item.status === "pending").length,
    revoked: certificates.filter((item) => item.status === "revoked").length,
  }), [certificates]);

  async function api(path: string, options: RequestInit = {}) {
    const headers = new Headers(options.headers);
    headers.set("Content-Type", "application/json");
    if (token) headers.set("Authorization", `Bearer ${token}`);

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const body = await response.json();
    if (!response.ok) throw new Error(body.error ?? "Request failed");
    return body;
  }

  async function loadCertificates() {
    if (!token) return;
    try {
      const data = await api("/api/certificates");
      setCertificates(data.items);
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  useEffect(() => {
    void loadCertificates();
  }, [token]);

  async function login(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      const data = await fetch(`${API_URL}/api/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: form.get("email"), password: form.get("password") }),
      }).then(async (response) => {
        const body = await response.json();
        if (!response.ok) throw new Error(body.error ?? "Login failed");
        return body;
      });
      sessionStorage.setItem("certichain-token", data.token);
      setToken(data.token);
      setMessage("Sesión iniciada correctamente.");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function issue(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    try {
      await api("/api/certificates", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      event.currentTarget.reset();
      setMessage("Certificado registrado. Si blockchain está configurado, fue emitido on-chain.");
      await loadCertificates();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/certificates/${encodeURIComponent(id)}/revoke`, { method: "POST" });
      setMessage("Certificado revocado.");
      await loadCertificates();
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function verify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const id = encodeURIComponent(String(form.get("id")));
    const hash = encodeURIComponent(String(form.get("hash")));

    try {
      const result = await fetch(`${API_URL}/api/verify/${id}?hash=${hash}`).then(async (response) => {
        const body = await response.json();
        if (!response.ok && response.status !== 404) throw new Error(body.error ?? "Verification failed");
        return body;
      });
      setVerification(result);
    } catch (error) {
      setVerification({ valid: false, error: (error as Error).message });
    }
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-mark">CC</div>
          <p className="eyebrow">ACADEMIC CREDENTIAL SECURITY</p>
          <h1>CertiChain</h1>
          <p className="muted">Emite y verifica credenciales académicas con integridad criptográfica y blockchain.</p>
          <form onSubmit={login} className="form-grid">
            <label>Email<input name="email" type="email" defaultValue="admin@certichain.local" required /></label>
            <label>Contraseña<input name="password" type="password" defaultValue="CertiChain123!" required /></label>
            <button type="submit">Entrar al portal</button>
          </form>
          {message && <p className="notice">{message}</p>}
        </section>
      </main>
    );
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div><span className="brand-mark small">CC</span><strong>CertiChain</strong></div>
        <button className="ghost" onClick={() => { sessionStorage.removeItem("certichain-token"); setToken(""); }}>Cerrar sesión</button>
      </header>

      <section className="hero">
        <p className="eyebrow">SECURE · VERIFIABLE · IMMUTABLE</p>
        <h1>Portal institucional</h1>
        <p>Gestión de certificados, trazabilidad y verificación desde una sola interfaz.</p>
      </section>

      <section className="stats-grid">
        <article><span>Total</span><strong>{stats.total}</strong></article>
        <article><span>Activos</span><strong>{stats.active}</strong></article>
        <article><span>Pendientes</span><strong>{stats.pending}</strong></article>
        <article><span>Revocados</span><strong>{stats.revoked}</strong></article>
      </section>

      {message && <p className="notice">{message}</p>}

      <section className="workspace-grid">
        <article className="panel">
          <h2>Emitir certificado</h2>
          <form onSubmit={issue} className="form-grid two-columns">
            <label>Estudiante<input name="studentName" required /></label>
            <label>Wallet<input name="studentWallet" placeholder="0x..." required /></label>
            <label>Título<input name="title" required /></label>
            <label>Institución<input name="institution" required /></label>
            <label>Fecha<input name="issuedAt" type="date" required /></label>
            <label>Metadata URI<input name="metadataURI" placeholder="ipfs://..." required /></label>
            <label className="full">SHA-256<input name="documentHash" placeholder="0x + 64 hex" required /></label>
            <button className="full" type="submit">Emitir / registrar</button>
          </form>
        </article>

        <article className="panel">
          <h2>Verificación pública</h2>
          <form onSubmit={verify} className="form-grid">
            <label>ID o Blockchain ID<input name="id" required /></label>
            <label>SHA-256<input name="hash" required /></label>
            <button type="submit">Verificar credencial</button>
          </form>
          {verification && (
            <div className={`verification ${verification.valid ? "valid" : "invalid"}`}>
              <strong>{verification.valid ? "✓ Credencial válida" : "✕ No verificada"}</strong>
              {verification.certificate && <span>{verification.certificate.title} · {verification.certificate.institution}</span>}
              {verification.error && <span>{verification.error}</span>}
            </div>
          )}
        </article>
      </section>

      <section className="panel">
        <div className="panel-heading"><h2>Certificados recientes</h2><button className="ghost" onClick={() => void loadCertificates()}>Actualizar</button></div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Estudiante</th><th>Credencial</th><th>Institución</th><th>Estado</th><th>ID</th><th></th></tr></thead>
            <tbody>
              {certificates.length === 0 && <tr><td colSpan={6} className="empty">No hay certificados registrados todavía.</td></tr>}
              {certificates.map((certificate) => (
                <tr key={certificate.id}>
                  <td>{certificate.studentName}</td>
                  <td>{certificate.title}</td>
                  <td>{certificate.institution}</td>
                  <td><span className={`status ${certificate.status}`}>{certificate.status}</span></td>
                  <td className="mono">{certificate.blockchainId ?? certificate.id}</td>
                  <td>{certificate.status !== "revoked" && <button className="danger" onClick={() => void revoke(certificate.id)}>Revocar</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
