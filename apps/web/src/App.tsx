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

type View = "dashboard" | "certificates" | "issue";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:4000";
const PAGE_SIZE = 5;

function formatDate(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("es-DO", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(date);
}

function shortId(certificate: Certificate) {
  const value = certificate.blockchainId ?? certificate.id;
  return value.length > 18 ? `${value.slice(0, 10)}…${value.slice(-6)}` : value;
}

function statusLabel(status: Certificate["status"]) {
  if (status === "active") return "Vigente";
  if (status === "revoked") return "Revocado";
  return "Pendiente";
}

export function App() {
  const [token, setToken] = useState(() => sessionStorage.getItem("certichain-token") ?? "");
  const [certificates, setCertificates] = useState<Certificate[]>([]);
  const [message, setMessage] = useState("");
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

  const institutionCount = useMemo(
    () => new Set(certificates.map((item) => item.institution)).size,
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

  const donutBackground = useMemo(() => {
    if (stats.total === 0) return "conic-gradient(#1e293b 0 100%)";
    const activeEnd = (stats.active / stats.total) * 100;
    const revokedEnd = ((stats.active + stats.revoked) / stats.total) * 100;
    return `conic-gradient(#22c55e 0 ${activeEnd}%, #ef4444 ${activeEnd}% ${revokedEnd}%, #f59e0b ${revokedEnd}% 100%)`;
  }, [stats]);

  useEffect(() => {
    if (page > totalPages) setPage(totalPages);
  }, [page, totalPages]);

  useEffect(() => {
    if (!message || !token) return;
    const timer = window.setTimeout(() => setMessage(""), 3500);
    return () => window.clearTimeout(timer);
  }, [message, token]);

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

  function navigate(nextView: View) {
    setView(nextView);
    setMessage("");
  }

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
    const formElement = event.currentTarget;
    const form = new FormData(formElement);
    try {
      await api("/api/certificates", {
        method: "POST",
        body: JSON.stringify(Object.fromEntries(form.entries())),
      });
      formElement.reset();
      setMessage("Certificado registrado correctamente.");
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

  function logout() {
    sessionStorage.removeItem("certichain-token");
    setToken("");
    setMessage("");
  }

  if (!token) {
    return (
      <main className="auth-shell">
        <section className="auth-card">
          <div className="brand-lockup auth-brand">
            <div className="brand-mark">CC</div>
            <div>
              <strong>CertiChain</strong>
              <span>Verified. Immutable. Trusted.</span>
            </div>
          </div>
          <p className="eyebrow">ACADEMIC CREDENTIAL SECURITY</p>
          <h1>Portal institucional</h1>
          <p className="muted">
            Emite y administra credenciales académicas con integridad criptográfica y evidencia verificable.
          </p>
          <form onSubmit={login} className="form-grid">
            <label>
              Email
              <input name="email" type="email" defaultValue="admin@certichain.local" required />
            </label>
            <label>
              Contraseña
              <input name="password" type="password" placeholder="Contraseña del entorno local" required />
            </label>
            <button type="submit">Entrar al portal</button>
          </form>
          {message && <p className="notice">{message}</p>}
          <a href="/verify" className="public-access-link">
            Verificar una credencial sin iniciar sesión ↗
          </a>
        </section>
      </main>
    );
  }

  return (
    <main className="dashboard-shell">
      <aside className="sidebar">
        <div className="brand-lockup">
          <div className="brand-mark small">CC</div>
          <div>
            <strong>CertiChain</strong>
            <span>Verified. Immutable. Trusted.</span>
          </div>
        </div>

        <nav className="sidebar-nav">
          <button className={view === "dashboard" ? "active" : ""} onClick={() => navigate("dashboard")}>
            ⌂ <span>Dashboard</span>
          </button>
          <button className={view === "certificates" ? "active" : ""} onClick={() => navigate("certificates")}>
            ▣ <span>Certificados</span>
          </button>
          <button className={view === "issue" ? "active" : ""} onClick={() => navigate("issue")}>
            ＋ <span>Emitir certificado</span>
          </button>
          <a href="/verify" target="_blank" rel="noreferrer">
            ⌕ <span>Verificador público</span><small>↗</small>
          </a>
        </nav>

        <div className="sidebar-spacer" />
        <div className="profile-card">
          <div className="avatar">AM</div>
          <div>
            <strong>Admin CertiChain</strong>
            <span>admin@certichain.local</span>
          </div>
        </div>
      </aside>

      <section className="content-shell">
        <header className="topbar">
          <div>
            <p className="eyebrow">PORTAL INSTITUCIONAL</p>
            <strong>
              {view === "dashboard" ? "Dashboard" : view === "certificates" ? "Certificados" : "Emitir certificado"}
            </strong>
          </div>
          <div className="topbar-actions">
            <a className="topbar-public-link" href="/verify" target="_blank" rel="noreferrer">
              Verificador público ↗
            </a>
            <button className="ghost" onClick={logout}>Cerrar sesión</button>
          </div>
        </header>

        {message && <p className="notice content-notice" role="status">{message}</p>}

        {view === "dashboard" && (
          <>
            <section className="page-heading">
              <div>
                <h1>Dashboard</h1>
                <p>Resumen general de la plataforma</p>
              </div>
              <select aria-label="Rango de fechas" defaultValue="30">
                <option value="30">Últimos 30 días</option>
                <option value="90">Últimos 90 días</option>
                <option value="365">Último año</option>
              </select>
            </section>

            <section className="stats-grid">
              <article>
                <span>Certificados emitidos</span>
                <strong>{stats.total}</strong>
                <small>Base registrada</small>
              </article>
              <article>
                <span>Credenciales vigentes</span>
                <strong>{stats.active}</strong>
                <small>Disponibles para verificar</small>
              </article>
              <article>
                <span>Revocados</span>
                <strong>{stats.revoked}</strong>
                <small>Estado actual</small>
              </article>
              <article>
                <span>Instituciones</span>
                <strong>{institutionCount}</strong>
                <small>Emisores registrados</small>
              </article>
            </section>

            <section className="dashboard-grid">
              <article className="panel activity-panel">
                <div className="panel-heading">
                  <div>
                    <p className="eyebrow">ACTIVIDAD</p>
                    <h2>Actividad reciente</h2>
                  </div>
                  {recentActivity.length > 0 && (
                    <button className="text-button" onClick={() => navigate("certificates")}>Ver todo</button>
                  )}
                </div>
                <div className="activity-list">
                  {recentActivity.length === 0 ? (
                    <div className="empty-state">
                      <div className="empty-state-icon">◇</div>
                      <strong>Aún no hay credenciales registradas</strong>
                      <p>Emite tu primer certificado para comenzar a poblar el dashboard y la trazabilidad.</p>
                      <button onClick={() => navigate("issue")}>＋ Emitir primer certificado</button>
                    </div>
                  ) : (
                    recentActivity.map((certificate) => (
                      <button
                        key={certificate.id}
                        className="activity-row"
                        onClick={() => setSelectedCertificate(certificate)}
                      >
                        <span className={`activity-dot ${certificate.status}`} />
                        <span>
                          <strong>{certificate.status === "revoked" ? "Certificado revocado" : "Certificado registrado"}</strong>
                          <small>{certificate.title} · {certificate.studentName}</small>
                        </span>
                        <time>{formatDate(certificate.issuedAt)}</time>
                      </button>
                    ))
                  )}
                </div>
              </article>

              <article className="panel status-panel">
                <p className="eyebrow">ESTADO</p>
                <h2>Certificados por estado</h2>
                <div className="donut-wrap">
                  <div className={`donut ${stats.total === 0 ? "empty-donut" : ""}`} style={{ background: donutBackground }}>
                    <div>
                      <strong>{stats.total === 0 ? "—" : stats.total}</strong>
                      <span>{stats.total === 0 ? "Sin datos" : "Total"}</span>
                    </div>
                  </div>
                  <div className="legend">
                    <span><i className="green" /> Vigentes <strong>{stats.active}</strong></span>
                    <span><i className="red" /> Revocados <strong>{stats.revoked}</strong></span>
                    <span><i className="yellow" /> Pendientes <strong>{stats.pending}</strong></span>
                  </div>
                </div>
              </article>
            </section>
          </>
        )}

        {view === "certificates" && (
          <section className="panel certificates-page">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">GESTIÓN</p>
                <h2>Lista de certificados</h2>
                <p className="muted">Gestiona todos los certificados registrados.</p>
              </div>
              <button onClick={() => navigate("issue")}>＋ Emitir certificado</button>
            </div>

            <div className="filters">
              <input
                value={query}
                onChange={(event) => { setQuery(event.target.value); setPage(1); }}
                placeholder="Buscar certificado, estudiante, institución o ID..."
              />
              <select
                value={statusFilter}
                onChange={(event) => { setStatusFilter(event.target.value); setPage(1); }}
              >
                <option value="all">Estado: todos</option>
                <option value="active">Vigentes</option>
                <option value="pending">Pendientes</option>
                <option value="revoked">Revocados</option>
              </select>
              <button className="ghost" onClick={() => void loadCertificates()}>Actualizar</button>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>ID / Blockchain ID</th>
                    <th>Estudiante</th>
                    <th>Título</th>
                    <th>Fecha</th>
                    <th>Estado</th>
                    <th>Acciones</th>
                  </tr>
                </thead>
                <tbody>
                  {visibleCertificates.length === 0 && (
                    <tr>
                      <td colSpan={6} className="empty">
                        <div className="table-empty-state">
                          <strong>{certificates.length === 0 ? "No hay certificados registrados" : "Sin resultados"}</strong>
                          <span>
                            {certificates.length === 0
                              ? "Emite una credencial para verla aquí."
                              : "Prueba con otros términos o cambia el filtro de estado."}
                          </span>
                        </div>
                      </td>
                    </tr>
                  )}
                  {visibleCertificates.map((certificate) => (
                    <tr key={certificate.id}>
                      <td className="mono">{shortId(certificate)}</td>
                      <td>{certificate.studentName}</td>
                      <td>
                        {certificate.title}
                        <small className="table-subtitle">{certificate.institution}</small>
                      </td>
                      <td>{formatDate(certificate.issuedAt)}</td>
                      <td><span className={`status ${certificate.status}`}>{statusLabel(certificate.status)}</span></td>
                      <td className="actions">
                        <button className="icon-button" title="Ver detalle" onClick={() => setSelectedCertificate(certificate)}>◉</button>
                        {certificate.status !== "revoked" && (
                          <button className="danger" onClick={() => void revoke(certificate.id)}>Revocar</button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="pagination">
              <button className="ghost" disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))}>‹</button>
              <span>Página {page} de {totalPages}</span>
              <button className="ghost" disabled={page === totalPages} onClick={() => setPage((value) => Math.min(totalPages, value + 1))}>›</button>
            </div>
          </section>
        )}

        {view === "issue" && (
          <section className="panel form-page">
            <div>
              <p className="eyebrow">EMISIÓN</p>
              <h2>Emitir certificado</h2>
              <p className="muted">Registra una credencial académica y prepara su evidencia verificable.</p>
            </div>
            <form onSubmit={issue} className="form-grid two-columns">
              <label>Estudiante<input name="studentName" placeholder="Ej. Ana Pérez" required /></label>
              <label>Wallet<input name="studentWallet" placeholder="0x..." required /></label>
              <label>Título<input name="title" placeholder="Ej. Ingeniería de Software" required /></label>
              <label>Institución<input name="institution" placeholder="Ej. Universidad Demo" required /></label>
              <label>Fecha<input name="issuedAt" type="date" required /></label>
              <label>Metadata URI<input name="metadataURI" placeholder="ipfs://..." required /></label>
              <label className="full">SHA-256<input name="documentHash" placeholder="0x + 64 caracteres hexadecimales" required /></label>
              <button className="full" type="submit">Emitir / registrar certificado</button>
            </form>
          </section>
        )}
      </section>

      {selectedCertificate && (
        <div className="modal-backdrop" onClick={() => setSelectedCertificate(null)}>
          <aside className="detail-drawer" onClick={(event) => event.stopPropagation()}>
            <button className="close-button" onClick={() => setSelectedCertificate(null)}>×</button>
            <p className="eyebrow">DETALLE DE CREDENCIAL</p>
            <h2>{selectedCertificate.title}</h2>
            <div className="credential-summary">
              <span>Estudiante<strong>{selectedCertificate.studentName}</strong></span>
              <span>Institución<strong>{selectedCertificate.institution}</strong></span>
              <span>Fecha de emisión<strong>{formatDate(selectedCertificate.issuedAt)}</strong></span>
              <span>Estado<strong className={`status ${selectedCertificate.status}`}>{statusLabel(selectedCertificate.status)}</strong></span>
              <span>ID / Blockchain ID<strong className="mono">{selectedCertificate.blockchainId ?? selectedCertificate.id}</strong></span>
            </div>
            {selectedCertificate.status !== "revoked" && (
              <button className="danger full-width" onClick={() => void revoke(selectedCertificate.id)}>Revocar certificado</button>
            )}
          </aside>
        </div>
      )}
    </main>
  );
}
