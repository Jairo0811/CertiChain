import { useCallback, useEffect, useState } from "react";
import { AppShell } from "./components/layout/AppShell";
import { ToastProvider } from "./components/ui/Toast";
import { useAsync } from "./hooks/useAsync";
import { useRoute } from "./hooks/useRoute";
import { configureApiClient } from "./lib/api";
import { clearSession, loadSession, saveSession } from "./lib/session";
import { CertificatesPage } from "./pages/CertificatesPage";
import { DashboardPage } from "./pages/DashboardPage";
import { IssuePage } from "./pages/IssuePage";
import { LoginPage } from "./pages/LoginPage";
import { systemService } from "./services";
import type { Session } from "./types";

const TITLES = { dashboard: "Resumen", certificates: "Certificados", issue: "Emitir certificado" } as const;

/** Institutional portal root: session lifecycle, routing and the authenticated shell. */
export function App() {
  const [session, setSession] = useState<Session | null>(() => loadSession());
  const [notice, setNotice] = useState<string>();
  const { route, navigate, href } = useRoute();
  const [openCertificate, setOpenCertificate] = useState<{ id: string; validate?: boolean } | null>(null);

  const endSession = useCallback((message?: string) => {
    clearSession();
    setSession(null);
    setOpenCertificate(null);
    setNotice(message);
  }, []);

  useEffect(() => {
    configureApiClient({
      getToken: () => loadSession()?.token ?? null,
      onSessionInvalid: (code) =>
        endSession(
          code === "session_expired"
            ? "Tu sesión expiró. Inicia sesión de nuevo para continuar."
            : "Tu sesión ya no es válida. Inicia sesión de nuevo.",
        ),
    });
  }, [endSession]);

  // Proactively end the session when the token expires, instead of waiting for a failed request.
  useEffect(() => {
    if (!session) return;
    const remaining = Date.parse(session.expiresAt) - Date.now();
    const timer = window.setTimeout(
      () => endSession("Tu sesión expiró. Inicia sesión de nuevo para continuar."),
      Math.max(remaining, 0),
    );
    return () => window.clearTimeout(timer);
  }, [session, endSession]);

  const health = useAsync(() => (session ? systemService.health() : Promise.resolve(undefined)), [Boolean(session)]);

  useEffect(() => {
    document.title = session ? `${TITLES[route]} · CertiChain` : "Portal institucional · CertiChain";
  }, [route, session]);

  function authenticated(next: Session) {
    saveSession(next);
    setNotice(undefined);
    setSession(next);
  }

  function openFromDashboard(id: string) {
    setOpenCertificate({ id });
    navigate("certificates");
  }

  if (!session) {
    return (
      <ToastProvider>
        <LoginPage onAuthenticated={authenticated} notice={notice} />
      </ToastProvider>
    );
  }

  const modeLabel = health.data
    ? `${health.data.blockchainConfigured ? "Blockchain conectada" : "Modo off-chain"}, persistencia ${health.data.persistence === "postgres" ? "PostgreSQL" : "JSON local"}`
    : undefined;

  return (
    <ToastProvider>
      <AppShell
        route={route}
        title={TITLES[route]}
        user={session.user}
        href={href}
        onNavigate={navigate}
        onLogout={() => endSession("Sesión cerrada.")}
        modeLabel={modeLabel}
      >
        {route === "dashboard" && <DashboardPage onOpenCertificate={openFromDashboard} onIssue={() => navigate("issue")} />}
        {route === "certificates" && (
          <CertificatesPage
            user={session.user}
            openId={openCertificate}
            onOpenChange={setOpenCertificate}
            onIssue={() => navigate("issue")}
          />
        )}
        {route === "issue" && <IssuePage onOpenCertificate={openFromDashboard} />}
      </AppShell>
    </ToastProvider>
  );
}
