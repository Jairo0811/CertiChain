import type { ReactNode } from "react";
import { Icon, type IconName } from "./Icon";

export function Spinner({ label = "Cargando" }: { label?: string }) {
  return <span className="spinner" role="progressbar" aria-label={label} />;
}

export function EmptyState({
  icon = "certificates",
  title,
  children,
  action,
}: {
  icon?: IconName;
  title: string;
  children?: ReactNode;
  action?: ReactNode;
}) {
  return (
    <div className="empty-state">
      <span className="empty-icon">
        <Icon name={icon} size={22} />
      </span>
      <strong>{title}</strong>
      {children && <p>{children}</p>}
      {action}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="error-state" role="alert">
      <Icon name="alert" />
      <span>{message}</span>
      {onRetry && (
        <button type="button" className="button ghost small" onClick={onRetry}>
          <Icon name="refresh" size={16} /> Reintentar
        </button>
      )}
    </div>
  );
}

export function Brand({ compact = false }: { compact?: boolean }) {
  return (
    <div className={`brand ${compact ? "compact" : ""}`}>
      <img src="/branding/certichain-isotipo-96.png" alt="" width={compact ? 32 : 40} height={compact ? 32 : 40} />
      <span className="brand-text">
        <strong>CertiChain</strong>
        {!compact && <span>Credenciales académicas verificables</span>}
      </span>
    </div>
  );
}
