import { FormEvent, useState } from "react";
import { Brand } from "../components/ui/Feedback";
import { Field } from "../components/ui/Field";
import { Icon } from "../components/ui/Icon";
import { ApiError, messageFor } from "../lib/api";
import { authService } from "../services";
import type { Session } from "../types";

/** Demo credentials hint is only rendered in dev builds or builds explicitly flagged as demo. */
const SHOW_DEMO_HINT = import.meta.env.DEV || import.meta.env.VITE_DEMO_MODE === "true";

export function LoginPage({ onAuthenticated, notice }: { onAuthenticated: (session: Session) => void; notice?: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [touched, setTouched] = useState({ email: false, password: false });

  const emailError = !email.trim()
    ? "Introduce tu correo institucional."
    : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())
      ? "El correo no tiene un formato válido."
      : "";
  const passwordError = password.length === 0 ? "Introduce tu contraseña." : password.length < 8 ? "La contraseña tiene al menos 8 caracteres." : "";

  async function submit(event: FormEvent) {
    event.preventDefault();
    setTouched({ email: true, password: true });
    if (emailError || passwordError || busy) return;
    setBusy(true);
    setError("");
    try {
      onAuthenticated(await authService.login(email.trim(), password));
    } catch (reason) {
      // invalid_credentials covers unknown email and wrong password alike (no enumeration).
      setError(
        reason instanceof ApiError && reason.code === "validation_failed"
          ? "Revisa el correo y la contraseña."
          : messageFor(reason, "No fue posible iniciar sesión."),
      );
      setPassword("");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="login-page">
      <aside className="login-brand" aria-hidden="true">
        <picture>
          <source srcSet="/branding/certichain-logo-960.webp" type="image/webp" />
          <img src="/branding/certichain-logo-960.jpg" alt="" width={960} height={640} />
        </picture>
        <p className="login-statement">
          Emisión, revocación y verificación de credenciales académicas con evidencia SHA-256 cifrada y ancla opcional en blockchain.
        </p>
      </aside>

      <main className="login-main" id="main">
        <div className="login-card">
          <Brand />
          <h1>Portal institucional</h1>
          <p className="muted">Acceso para el personal autorizado a emitir y administrar credenciales.</p>

          {notice && (
            <p className="notice-banner" role="status">
              <Icon name="clock" size={16} /> {notice}
            </p>
          )}

          <form className="stack" onSubmit={submit} noValidate>
            <Field label="Correo institucional" error={touched.email ? emailError || undefined : undefined}>
              {(field) => (
                <input
                  {...field}
                  type="email"
                  name="email"
                  autoComplete="username"
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  onBlur={() => setTouched((value) => ({ ...value, email: true }))}
                  required
                />
              )}
            </Field>

            <Field label="Contraseña" error={touched.password ? passwordError || undefined : undefined}>
              {(field) => (
                <span className="input-with-action">
                  <input
                    {...field}
                    type={showPassword ? "text" : "password"}
                    name="password"
                    autoComplete="current-password"
                    value={password}
                    onChange={(event) => setPassword(event.target.value)}
                    onBlur={() => setTouched((value) => ({ ...value, password: true }))}
                    required
                  />
                  <button
                    type="button"
                    className="icon-button"
                    onClick={() => setShowPassword((value) => !value)}
                    aria-label={showPassword ? "Ocultar contraseña" : "Mostrar contraseña"}
                    aria-pressed={showPassword}
                  >
                    <Icon name={showPassword ? "eyeOff" : "eye"} />
                  </button>
                </span>
              )}
            </Field>

            {error && (
              <p className="inline-error" role="alert">
                {error}
              </p>
            )}

            <button type="submit" className="button primary block" disabled={busy} aria-busy={busy}>
              {busy ? "Iniciando sesión…" : "Iniciar sesión"}
            </button>
          </form>

          {SHOW_DEMO_HINT && (
            <p className="demo-hint">
              Entorno de desarrollo: usa <code>admin@certichain.local</code> y la contraseña definida en <code>ADMIN_PASSWORD</code>.
            </p>
          )}

          <a href="/verify" className="verify-link">
            <Icon name="verify" size={16} /> ¿Necesitas comprobar una credencial? Abre el verificador público
          </a>
        </div>
      </main>
    </div>
  );
}
