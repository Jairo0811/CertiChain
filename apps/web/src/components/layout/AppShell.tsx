import { type ReactNode, useEffect, useState } from "react";
import type { PortalRoute } from "../../hooks/useRoute";
import type { SessionUser } from "../../types";
import { Brand } from "../ui/Feedback";
import { Icon, type IconName } from "../ui/Icon";

const NAV: Array<{ route: PortalRoute; label: string; icon: IconName }> = [
  { route: "dashboard", label: "Resumen", icon: "dashboard" },
  { route: "certificates", label: "Certificados", icon: "certificates" },
  { route: "issue", label: "Emitir certificado", icon: "issue" },
];

const ROLE_LABEL: Record<SessionUser["role"], string> = { admin: "Administración", issuer: "Emisión", verifier: "Consulta" };

export function AppShell({
  route,
  title,
  user,
  href,
  onNavigate,
  onLogout,
  modeLabel,
  children,
}: {
  route: PortalRoute;
  title: string;
  user: SessionUser;
  href: (route: PortalRoute) => string;
  onNavigate: (route: PortalRoute) => void;
  onLogout: () => void;
  modeLabel?: string;
  children: ReactNode;
}) {
  const [navOpen, setNavOpen] = useState(false);

  useEffect(() => {
    setNavOpen(false);
  }, [route]);

  useEffect(() => {
    if (!navOpen) return;
    const onKey = (event: KeyboardEvent) => event.key === "Escape" && setNavOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [navOpen]);

  const initials = user.email.slice(0, 2).toUpperCase();

  return (
    <div className="shell">
      <a href="#main" className="skip-link">
        Saltar al contenido
      </a>

      <aside className={`sidebar ${navOpen ? "open" : ""}`} aria-label="Navegación principal">
        <div className="sidebar-head">
          <Brand />
          <button type="button" className="icon-button only-mobile" onClick={() => setNavOpen(false)} aria-label="Cerrar menú">
            <Icon name="close" />
          </button>
        </div>
        <nav>
          <ul className="nav-list">
            {NAV.filter((item) => item.route !== "issue" || user.role !== "verifier").map((item) => (
              <li key={item.route}>
                <a
                  href={href(item.route)}
                  className="nav-link"
                  aria-current={route === item.route ? "page" : undefined}
                  onClick={(event) => {
                    if (event.metaKey || event.ctrlKey || event.shiftKey) return;
                    event.preventDefault();
                    onNavigate(item.route);
                  }}
                >
                  <Icon name={item.icon} />
                  {item.label}
                </a>
              </li>
            ))}
            <li>
              <a href="/verify" target="_blank" rel="noopener noreferrer" className="nav-link">
                <Icon name="verify" />
                Verificador público
                <Icon name="external" size={14} className="nav-external" label="(se abre en una pestaña nueva)" />
              </a>
            </li>
          </ul>
        </nav>
        {modeLabel && <p className="environment-note">{modeLabel}</p>}
      </aside>
      {navOpen && <div className="sidebar-scrim" onClick={() => setNavOpen(false)} aria-hidden="true" />}

      <div className="workspace">
        <header className="topbar">
          <button
            type="button"
            className="icon-button only-mobile"
            onClick={() => setNavOpen(true)}
            aria-label="Abrir menú de navegación"
            aria-expanded={navOpen}
          >
            <Icon name="menu" />
          </button>
          <h1 className="topbar-title">{title}</h1>
          <div className="topbar-user">
            <span className="avatar" aria-hidden="true">
              {initials}
            </span>
            <span className="user-meta">
              <strong>{user.email}</strong>
              <span>{ROLE_LABEL[user.role]}</span>
            </span>
            <button type="button" className="button ghost small" onClick={onLogout} aria-label="Cerrar sesión">
              <Icon name="logout" size={16} />
              <span className="hide-narrow" aria-hidden="true">Cerrar sesión</span>
            </button>
          </div>
        </header>
        <main id="main" className="content" tabIndex={-1}>
          {children}
        </main>
      </div>
    </div>
  );
}
