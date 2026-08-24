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

type View = "dashboard" | "certificates" | "issue" | "verify";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 5;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

function shortId(certificate: Certificate) {
  const value = certificate.blockchainId ?? certificate.id;
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("certichain-token") ?? "");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [message, setMessage] = useState("");
  const [verification, setVerification] = useState<Verification | null>(null);
  const [view, setView] = useState<View>("dashboard");
  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [page, setPage] = useState(1);
  const [selectedCertificate, setSelectedCertificate] = useState<Certificate | null>(null);

  const stats = useMemo(() => {
    const total = certificates.length;
    const active = certificates.filter((item) => item.status === "active").length;
    const pending = certificates.filter((item) => item.status === "pending").length;
    const revoked = certificates.filter((item) => item.status === "revoked").length;
    return { total, active, pending, revoked };
  }, [certificates]);

  const recentActivity = useMemo(
    () =>
      [...certificates]
        .sort((a, b) => new Date(b.issuedAt).getTime() - new Date(a.issuedAt).getTime())
        .slice(0, 4),
    [certificates],
  );

  const filteredCertificates = useMemo(() => {
    const normalized = query.trim().toLowerCase();
    return certificates.filter((certificate) => {
      const matchesStatus = statusFilter === "all" || certificate.status === statusFilter;
      const haystack = `${certificate.studentName} ${certificate.title} ${certificate.institution} ${certificate.blockchainId ?? certificate.id}`.toLowerCase();
      return matchesStatus && (!normalized || haystack.includes(normalized));
    });
  }, [certificates, query, statusFilter]);

  const totalPages = Math.max(1, Math.ceil(filteredCertificates.length / PAGE_SIZE));
  const visibleCertificates = filteredCertificates.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

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
      setView("certificates");
    } catch (error) {
      setMessage((error as Error).message);
    }
  }

  async function revoke(id: string) {
    try {
      await api(`/api/certificates/${encodeURIComponent(id)}/revoke`, { method: "POST" });
      setMessage("Certificado revocado.");
      await loadCertificates();
      setSelectedCertificate(null);
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

  function logout() {
    sessionStorage.removeItem("certichain-token");
    setToken("");
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup auth-brand"><div className="brand-mark">CC</div><div><strong>CertiChain</strong><span>Verified. Immutable. Trusted.</span></div></div>
          <p className="eyebrow">ACADEMIC CREDENTIAL SECURITY</p>
          <h1>Portal institucional</h1>
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
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup"><div className="brand-mark small">CC</div><div><strong>CertiChain</strong><span>Verified. Immutable. Trusted.</span></div></div>
        <nav className="sidebar-nav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => setView("dashboard")}>⌂ <span>Dashboard</span></button>
          <button className={view === "certificates" ? "active" : ""} onClick={() => setView("certificates")}>▣ <span>Certificados</span></button>
          <button className={view === "issue" ? "active" : ""} onClick={() => setView("issue")}>＋ <span>Emitir certificado</span></button>
          <button className={view === "verify" ? "active" : ""} onClick={() => setView("verify")}>⌕ <span>Verificación pública</span></button>
        </nav>
        <div className="sidebar-spacer" />
        <div className="profile-card"><div className="avatar">AM</div><div><strong>Admin CertiChain</strong><span>admin@certichain.local</span></div></div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div><p className="eyebrow">CERTICHAIN ACADEMY</p><strong>{view === "dashboard" ? "Dashboard" : view === "certificates" ? "Certificados" : view === "issue" ? "Emitir certificado" : "Verificación pública"}</strong></div>
          <div className="topbar-actions"><span className="notification">3</span><button className="ghost" onClick={logout}>Cerrar sesión</button></div>
        </header>

        {message && <p className="notice content-notice">{message}</p>}

        {view === "dashboard" && (
          <>
            <section className="page-heading"><div><h1>Dashboard</h1><p>Resumen general de la plataforma</p></div><select aria-label="Rango de fechas" defaultValue="30"><option value="30">Últimos 30 días</option><option value="90">Últimos 90 días</option><option value="365">Último año</option></select></section>
            <section className="stats-grid">
              <article><span>Certificados emitidos</span><strong>{stats.total}</strong><small>Base registrada</small></article>
              <article><span>Verificaciones</span><strong>{stats.total * 4}</strong><small>Estimado del portal</small></article>
              <article><span>Revocados</span><strong>{stats.revoked}</strong><small>Estado actual</small></article>
              <article><span>Instituciones</span><strong>{new Set(certificates.map((item) => item.institution)).size}</strong><small>Emisores registrados</small></article>
            </section>
            <section className="dashboard-grid">
              <article className="panel activity-panel"><div className="panel-heading"><div><p className="eyebrow">ACTIVIDAD</p><h2>Actividad reciente</h2></div><button className="text-button" onClick={() => setView("certificates")}>Ver todo</button></div>
                <div className="activity-list">
                  {recentActivity.length === 0 && <p className="empty-card">No hay actividad registrada todavía.</p>}
                  {recentActivity.map((certificate) => <button key={certificate.id} className="activity-row" onClick={() => setSelectedCertificate(certificate)}><span className={`activity-dot ${certificate.status}`} /><span><strong>{certificate.status === "revoked" ? "Certificado revocado" : "Certificado emitido"}</strong><small>{certificate.title} · {certificate.studentName}</small></span><time>{formatDate(certificate.issuedAt)}</time></button>)}
                </div>
              </article>
              <article className="panel status-panel"><p className="eyebrow">ESTADO</p><h2>Certificados por estado</h2><div className="donut-wrap"><div className="donut" style={{ background: `conic-gradient(#22c55e 0 ${(stats.active / Math.max(stats.total, 1)) * 100}%, #ef4444 ${(stats.active / Math.max(stats.total, 1)) * 100}% ${((stats.active + stats.revoked) / Math.max(stats.total, 1)) * 100}%, #f59e0b ${((stats.active + stats.revoked) / Math.max(stats.total, 1)) * 100}% 100%)` }}><div><strong>{stats.total}</strong><span>Total</span></div></div><div className="legend"><span><i className="green" /> Vigentes <strong>{stats.active}</strong></span><span><i className="red" /> Revocados <strong>{stats.revoked}</strong></span><span><i className="yellow" /> Pendientes <strong>{stats.pending}</strong></span></div></div></article>
            </section>
          </>
        )}

        {view === "certificates" && (
          <section className="panel certificates-page">
            <div className="panel-heading"><div><p className="eyebrow">GESTIÓN</p><h2>Lista de certificados</h2><p className="muted">Gestiona todos los certificados emitidos.</p></div><button onClick={() => setView("issue")}>＋ Emitir certificado</button></div>
            <div className="filters"><input value={query} onChange={(event) => { setQuery(event.target.value); setPage(1); }} placeholder="Buscar certificado, estudiante, institución o ID..." /><select value={statusFilter} onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}><option value="all">Estado: todos</option><option value="active">Vigentes</option><option value="pending">Pendientes</option><option value="revoked">Revocados</option></select><button className="ghost" onClick={() => void loadCertificates()}>Actualizar</button></div>
            <div className="table-wrap"><table><thead><tr><th>ID / Blockchain ID</th><th>Estudiante</th><th>Título</th><th>Fecha</th><th>Estado</th><th>Acciones</th></tr></thead><tbody>{visibleCertificates.length === 0 && <tr><td colSpan={6} className="empty">No hay certificados que coincidan con los filtros.</td></tr>}{visibleCertificates.map((certificate) => <tr key={certificate.id}><td className="mono">{shortId(certificate)}</td><td>{certificate.studentName}</td><td>{certificate.title}<small className="table-subtitle">{certificate.institution}</small></td><td>{formatDate(certificate.issuedAt)}</td><td><span className={`status ${certificate.status}`}>{certificate.status}</span></td><td className="actions"><button className="icon-button" title="Ver detalle" onClick={() => setSelectedCertificate(certificate)}>◉</button>{certificate.status !== "revoked" && <button className="danger" onClick={() => void revoke(certificate.id)}>Revocar</button>}</td></tr>)}</tbody></table></div>
            <div className="pagination"><button className="ghost" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button><span>Página {page} de {totalPages}</span><button className="ghost" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button></div>
          </section>
        )}

        {view === "issue" && (
          <section className="panel form-page"><div><p className="eyebrow">EMISIÓN</p><h2>Emitir certificado</h2><p className="muted">Registra una credencial académica y prepara su evidencia verificable.</p></div><form onSubmit={issue} className="form-grid two-columns"><label>Estudiante<input name="studentName" required /></label><label>Wallet<input name="studentWallet" placeholder="0x..." required /></label><label>Título<input name="title" required /></label><label>Institución<input name="institution" required /></label><label>Fecha<input name="issuedAt" type="date" required /></label><label>Metadata URI<input name="metadataURI" placeholder="ipfs://..." required /></label><label className="full">SHA-256<input name="documentHash" placeholder="0x + 64 hex" required /></label><button className="full" type="submit">Emitir / registrar certificado</button></form></section>
        )}

        {view === "verify" && (
          <section className="verify-layout"><article className="panel"><p className="eyebrow">VERIFICACIÓN</p><h2>Verificación pública</h2><p className="muted">Valida la autenticidad de una credencial por ID y hash SHA-256.</p><form onSubmit={verify} className="form-grid"><label>ID o Blockchain ID<input name="id" required /></label><label>SHA-256<input name="hash" required /></label><button type="submit">Verificar credencial</button></form></article>{verification && <article className={`panel verification-card ${verification.valid ? "valid" : "invalid"}`}><div className="verification-icon">{verification.valid ? "✓" : "✕"}</div><h2>{verification.valid ? "Certificado válido" : "No verificado"}</h2>{verification.certificate && <div className="credential-summary"><span>Título<strong>{verification.certificate.title}</strong></span><span>Estudiante<strong>{verification.certificate.studentName}</strong></span><span>Institución<strong>{verification.certificate.institution}</strong></span><span>Fecha<strong>{formatDate(verification.certificate.issuedAt)}</strong></span><span>Estado<strong>{verification.certificate.status}</strong></span><span>ID<strong className="mono">{verification.certificate.blockchainId ?? verification.certificate.id}</strong></span></div>}{verification.error && <p>{verification.error}</p>}</article>}</section>
        )}
      </section>

      {selectedCertificate && <div className="modal-backdrop" onClick={() => setSelectedCertificate(null)}><aside className="detail-drawer" onClick={(event) => event.stopPropagation()}><button className="close-button" onClick={() => setSelectedCertificate(null)}>×</button><p className="eyebrow">DETALLE DE CREDENCIAL</p><h2>{selectedCertificate.title}</h2><div className="credential-summary"><span>Estudiante<strong>{selectedCertificate.studentName}</strong></span><span>Institución<strong>{selectedCertificate.institution}</strong></span><span>Fecha de emisión<strong>{formatDate(selectedCertificate.issuedAt)}</strong></span><span>Estado<strong className={`status ${selectedCertificate.status}`}>{selectedCertificate.status}</strong></span><span>ID / Blockchain ID<strong className="mono">{selectedCertificate.blockchainId ?? selectedCertificate.id}</strong></span></div>{selectedCertificate.status !== "revoked" && <button className="danger full-width" onClick={() => void revoke(selectedCertificate.id)}>Revocar certificado</button>}</aside></div>}
    </main>
  );
}
