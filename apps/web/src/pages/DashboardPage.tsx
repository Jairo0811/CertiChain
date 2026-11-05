import { useState } from "react";
import { InstitutionBars, IssuanceChart, StatusDistribution } from "../components/dashboard/Charts";
import { EmptyState, ErrorState, Spinner } from "../components/ui/Feedback";
import { Icon } from "../components/ui/Icon";
import { useAsync } from "../hooks/useAsync";
import { messageFor } from "../lib/api";
import { ACTION_LABEL, formatDate, formatRelative, STATUS_LABEL } from "../lib/format";
import { dashboardService } from "../services";
import type { DashboardRange, DashboardSummary } from "../types";

const RANGES: Array<{ key: DashboardRange; label: string }> = [
  { key: "30", label: "30 días" },
  { key: "90", label: "90 días" },
  { key: "365", label: "12 meses" },
  { key: "all", label: "Todo" },
];

function activityDetail(item: DashboardSummary["activity"][number]): string {
  const subject = item.title
    ? `${item.title}${item.studentName ? `, ${item.studentName}` : ""}`
    : "Credencial eliminada del registro";
  const metadata = item.metadata ?? {};
  if (item.action === "certificate.status" && metadata.previousStatus && metadata.nextStatus) {
    const label = (value: unknown) => STATUS_LABEL[value as keyof typeof STATUS_LABEL] ?? String(value);
    return `${subject}. De ${label(metadata.previousStatus).toLowerCase()} a ${label(metadata.nextStatus).toLowerCase()}`;
  }
  if (item.action === "certificate.anchor" && metadata.result === "anchored") return `${subject}. Anclaje confirmado`;
  if (item.action === "certificate.anchor") return `${subject}. Anclaje pendiente de confirmación o fallido`;
  return subject;
}

export function DashboardPage({ onOpenCertificate, onIssue }: { onOpenCertificate: (id: string) => void; onIssue: () => void }) {
  const [range, setRange] = useState<DashboardRange>("90");
  const { data, error, loading, reload } = useAsync((signal) => dashboardService.get(range, signal), [range]);

  return (
    <div className="page">
      <div className="page-head">
        <div>
          <h2 className="page-title">Actividad de emisión</h2>
          <p className="muted">
            Las cifras del periodo agrupan las credenciales por <strong>fecha de emisión académica</strong>, con su estado actual.
          </p>
        </div>
        <div className="segmented" role="radiogroup" aria-label="Periodo">
          {RANGES.map((item) => (
            <button
              key={item.key}
              type="button"
              role="radio"
              aria-checked={range === item.key}
              className={range === item.key ? "selected" : ""}
              onClick={() => setRange(item.key)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {error ? (
        <ErrorState message={messageFor(error, "No fue posible cargar el resumen.")} onRetry={reload} />
      ) : !data ? (
        <div className="loading-block">
          <Spinner label="Cargando resumen" />
        </div>
      ) : (
        <div className={`dashboard ${loading ? "is-refreshing" : ""}`} aria-busy={loading}>
          <section className="ledger-strip" aria-label="Indicadores del periodo">
            <div className="figure">
              <span className="figure-label">Emitidas en el periodo</span>
              <strong className="figure-value">{data.period.issued}</strong>
              <span className="figure-note">
                {data.trend
                  ? `${data.trend.changePercent >= 0 ? "+" : ""}${data.trend.changePercent} % frente a ${data.trend.previousIssued} del periodo anterior`
                  : `${data.allTime.total} en todo el registro`}
              </span>
            </div>
            <div className="figure">
              <span className="figure-label">Vigentes</span>
              <strong className="figure-value tone-success">{data.period.active}</strong>
              <span className="figure-note">{data.allTime.active} vigentes en total</span>
            </div>
            <div className="figure">
              <span className="figure-label">Pendientes</span>
              <strong className="figure-value tone-warning">{data.period.pending}</strong>
              <span className="figure-note">Aún no activas</span>
            </div>
            <div className="figure">
              <span className="figure-label">Revocadas</span>
              <strong className="figure-value tone-danger">{data.period.revoked}</strong>
              <span className="figure-note">
                {data.period.revocationsInRange}{" "}
                {data.period.revocationsInRange === 1 ? "revocación ejecutada" : "revocaciones ejecutadas"} en el periodo
              </span>
            </div>
            <div className="figure">
              <span className="figure-label">Instituciones</span>
              <strong className="figure-value">{data.period.institutions}</strong>
              <span className="figure-note">{data.allTime.institutions} en todo el registro</span>
            </div>
          </section>

          <div className="dashboard-grid">
            <section className="panel chart-panel" aria-labelledby="issuance-title">
              <header className="panel-head">
                <h3 id="issuance-title">
                  Emisiones por {data.range.granularity === "day" ? "día" : data.range.granularity === "week" ? "semana" : "mes"}
                </h3>
                <span className="muted small">
                  {data.range.from
                    ? `${formatDate(data.range.from)} – ${formatDate(data.range.to)}`
                    : `Hasta ${formatDate(data.range.to)}`}
                </span>
              </header>
              {data.period.issued === 0 ? (
                <EmptyState
                  icon="dashboard"
                  title="Sin emisiones en este periodo"
                  action={
                    <button type="button" className="button ghost small" onClick={() => setRange("all")}>
                      Ver todo el historial
                    </button>
                  }
                >
                  Ninguna credencial tiene fecha de emisión dentro del rango elegido.
                </EmptyState>
              ) : (
                <IssuanceChart series={data.series} granularity={data.range.granularity} />
              )}
            </section>

            <section className="panel" aria-labelledby="status-title">
              <header className="panel-head">
                <h3 id="status-title">Estado actual de lo emitido</h3>
              </header>
              <StatusDistribution active={data.period.active} pending={data.period.pending} revoked={data.period.revoked} />
              {data.period.onChain > 0 && (
                <p className="muted small chain-note">
                  <Icon name="chain" size={14} /> {data.period.onChain} anclada{data.period.onChain === 1 ? "" : "s"} en
                  blockchain
                </p>
              )}
            </section>

            <section className="panel" aria-labelledby="institutions-title">
              <header className="panel-head">
                <h3 id="institutions-title">Por institución</h3>
              </header>
              {data.byInstitution.length ? (
                <InstitutionBars items={data.byInstitution} />
              ) : (
                <p className="muted">Sin datos en este periodo.</p>
              )}
            </section>

            <section className="panel activity-panel" aria-labelledby="activity-title">
              <header className="panel-head">
                <h3 id="activity-title">Actividad reciente</h3>
                <span className="muted small">Eventos de auditoría</span>
              </header>
              {data.activity.length === 0 ? (
                <EmptyState
                  icon="clock"
                  title="Sin eventos en este periodo"
                  action={
                    <button type="button" className="button primary small" onClick={onIssue}>
                      <Icon name="issue" size={16} /> Emitir certificado
                    </button>
                  }
                >
                  Las emisiones, revocaciones y cambios de estado aparecerán aquí con su fecha real.
                </EmptyState>
              ) : (
                <ol className="activity-list">
                  {data.activity.map((item) => (
                    <li key={item.id}>
                      <span className={`activity-marker action-${item.action.replace(".", "-")}`} aria-hidden="true" />
                      <div className="activity-text">
                        {item.certificateId && item.title ? (
                          <button type="button" className="link-button" onClick={() => onOpenCertificate(item.certificateId!)}>
                            {ACTION_LABEL[item.action] ?? item.action}
                          </button>
                        ) : (
                          <strong>{ACTION_LABEL[item.action] ?? item.action}</strong>
                        )}
                        <span>{activityDetail(item)}</span>
                      </div>
                      <time dateTime={item.timestamp} title={new Date(item.timestamp).toLocaleString("es-DO")}>
                        {formatRelative(item.timestamp)}
                      </time>
                    </li>
                  ))}
                </ol>
              )}
            </section>
          </div>
        </div>
      )}
    </div>
  );
}
