import { useEffect, useRef, useState } from "react";
import type { DashboardSummary } from "../../types";

/** Tracks an element's width so SVG text keeps its real pixel size at any viewport. */
function useWidth<T extends HTMLElement>(fallback: number) {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const node = ref.current;
    if (!node || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(Math.max(260, Math.round(entry.contentRect.width)));
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return { ref, width };
}

/**
 * Issuance column chart. Plain SVG: three small charts don't justify a charting dependency.
 * A visually hidden table carries the same data for screen readers.
 */
export function IssuanceChart({ series, granularity }: { series: DashboardSummary["series"]; granularity: DashboardSummary["range"]["granularity"] }) {
  const max = Math.max(1, ...series.map((bucket) => bucket.issued));
  const { ref, width } = useWidth<HTMLElement>(640);
  const height = width < 480 ? 160 : 200;
  const gap = series.length > 20 ? 3 : 8;
  const slot = width / series.length;
  // Cap the bar width so a short range (e.g. 3 months) doesn't render slabs.
  const barWidth = Math.min((width - gap * (series.length - 1)) / series.length, 44);
  // Roughly one label per 64px so axis text never collides.
  const labelEvery = Math.max(1, Math.ceil(series.length / Math.max(1, Math.floor(width / 64))));
  const ticks = max <= 4 ? Array.from({ length: max + 1 }, (_, index) => index) : [0, Math.round(max / 2), max];
  const unit = granularity === "day" ? "Día" : granularity === "week" ? "Semana desde" : "Mes";

  return (
    <figure className="chart" ref={ref}>
      <svg width={width} height={height + 28} viewBox={`0 0 ${width} ${height + 28}`} role="img" aria-label="Emisiones por periodo">
        {ticks.map((tick) => {
          const y = height - (tick / max) * (height - 12);
          return (
            <g key={tick}>
              <line x1={0} x2={width} y1={y} y2={y} className="chart-grid" />
              <text x={width} y={y - 4} className="chart-tick" textAnchor="end">
                {tick}
              </text>
            </g>
          );
        })}
        {series.map((bucket, index) => {
          const barHeight = (bucket.issued / max) * (height - 12);
          const x = index * slot + (slot - barWidth) / 2;
          return (
            <g key={bucket.key}>
              <rect
                x={x}
                y={height - barHeight}
                width={barWidth}
                height={Math.max(barHeight, bucket.issued ? 2 : 0)}
                rx={Math.min(3, barWidth / 3)}
                className="chart-bar"
              >
                <title>
                  {bucket.label}: {bucket.issued} {bucket.issued === 1 ? "emisión" : "emisiones"}
                </title>
              </rect>
              {index % labelEvery === 0 && (
                <text x={x + barWidth / 2} y={height + 18} className="chart-label" textAnchor="middle">
                  {bucket.label}
                </text>
              )}
            </g>
          );
        })}
      </svg>
      <table className="visually-hidden">
        <caption>Emisiones por periodo</caption>
        <thead>
          <tr>
            <th scope="col">{unit}</th>
            <th scope="col">Emisiones</th>
          </tr>
        </thead>
        <tbody>
          {series.map((bucket) => (
            <tr key={bucket.key}>
              <td>{bucket.label}</td>
              <td>{bucket.issued}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </figure>
  );
}

/** Single stacked bar: easier to compare proportions than a donut, and labels stay readable. */
export function StatusDistribution({ active, pending, revoked }: { active: number; pending: number; revoked: number }) {
  const total = active + pending + revoked;
  const parts = [
    { key: "active", label: "Vigentes", value: active },
    { key: "pending", label: "Pendientes", value: pending },
    { key: "revoked", label: "Revocadas", value: revoked },
  ];
  return (
    <div className="distribution">
      <div className="distribution-bar" role="img" aria-label={parts.map((part) => `${part.label}: ${part.value}`).join(", ")}>
        {total === 0 ? (
          <span className="segment empty" style={{ width: "100%" }} />
        ) : (
          parts.map((part) =>
            part.value ? <span key={part.key} className={`segment status-${part.key}`} style={{ width: `${(part.value / total) * 100}%` }} /> : null,
          )
        )}
      </div>
      <ul className="distribution-legend">
        {parts.map((part) => (
          <li key={part.key}>
            <span className={`legend-swatch status-${part.key}`} aria-hidden="true" />
            <span>{part.label}</span>
            <strong>{part.value}</strong>
            <span className="muted">{total ? `${Math.round((part.value / total) * 100)} %` : "—"}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function InstitutionBars({ items }: { items: DashboardSummary["byInstitution"] }) {
  const max = Math.max(1, ...items.map((item) => item.issued));
  return (
    <ul className="institution-list">
      {items.map((item) => (
        <li key={item.institution}>
          <div className="institution-row">
            <span className="institution-name">{item.institution}</span>
            <strong>{item.issued}</strong>
          </div>
          <span className="institution-track" aria-hidden="true">
            <span style={{ width: `${(item.issued / max) * 100}%` }} />
          </span>
        </li>
      ))}
    </ul>
  );
}
