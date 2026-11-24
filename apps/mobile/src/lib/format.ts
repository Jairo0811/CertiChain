import type { ConnectionState } from "../types";

export function formatDate(value: string, withTime = false) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return withTime
    ? new Intl.DateTimeFormat("es-DO", { dateStyle: "medium", timeStyle: "short" }).format(date)
    : new Intl.DateTimeFormat("es-DO", { day: "2-digit", month: "short", year: "numeric" }).format(date);
}

export function connectionLabel(state: ConnectionState) {
  if (state === "connected") return "Conectado";
  if (state === "checking") return "Comprobando";
  if (state === "unconfigured") return "Sin configurar";
  return "Sin conexión";
}
