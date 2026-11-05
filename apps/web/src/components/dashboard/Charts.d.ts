import type { DashboardSummary } from "../../types";
/**
 * Issuance column chart. Plain SVG: three small charts don't justify a charting dependency.
 * A visually hidden table carries the same data for screen readers.
 */
export declare function IssuanceChart({
  series,
  granularity,
}: {
  series: DashboardSummary["series"];
  granularity: DashboardSummary["range"]["granularity"];
}): import("react").JSX.Element;
/** Single stacked bar: easier to compare proportions than a donut, and labels stay readable. */
export declare function StatusDistribution({
  active,
  pending,
  revoked,
}: {
  active: number;
  pending: number;
  revoked: number;
}): import("react").JSX.Element;
export declare function InstitutionBars({ items }: { items: DashboardSummary["byInstitution"] }): import("react").JSX.Element;
