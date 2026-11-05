/**
 * Centralized HTTP client: base URL resolution, auth header, timeouts and uniform errors.
 *
 * The API base defaults to the same origin ("" → relative /api/... paths). In Docker the bundled
 * nginx proxies /api to the API container, so a deployed build never points at the visitor's
 * own localhost. VITE_API_URL can still override it for split deployments.
 */
const configured = (import.meta.env.VITE_API_URL ?? "").trim();
export const API_URL = configured.replace(/\/$/, "");

export type ApiErrorCode =
  | "network"
  | "timeout"
  | "invalid_response"
  | "unauthenticated"
  | "session_expired"
  | "forbidden"
  | "not_found"
  | "conflict"
  | "validation_failed"
  | "invalid_credentials"
  | "rate_limited"
  | "blockchain_unavailable"
  | "blockchain_not_configured"
  | "storage_unavailable"
  | "integrity_failure"
  | "internal_error"
  | "unknown";

export class ApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
    public readonly status = 0,
    public readonly details?: { fieldErrors?: Record<string, string[]> },
    public readonly body?: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/** Spanish, user-facing messages per error code. Server messages are never shown verbatim. */
const MESSAGES: Partial<Record<ApiErrorCode, string>> = {
  network: "No fue posible conectar con la API de CertiChain. Comprueba tu conexión e inténtalo de nuevo.",
  timeout: "La API tardó demasiado en responder. Inténtalo de nuevo.",
  invalid_response: "La API respondió con un formato inesperado.",
  unauthenticated: "Tu sesión no es válida. Inicia sesión de nuevo.",
  session_expired: "Tu sesión expiró. Inicia sesión de nuevo para continuar.",
  forbidden: "Tu rol no tiene permiso para realizar esta operación.",
  not_found: "No se encontró el recurso solicitado.",
  invalid_credentials: "Correo o contraseña incorrectos.",
  rate_limited: "Demasiados intentos seguidos. Espera un momento antes de reintentar.",
  blockchain_unavailable: "La red blockchain no está accesible en este momento. No se aplicó ningún cambio.",
  blockchain_not_configured: "Esta operación requiere la integración blockchain, que no está configurada en este entorno.",
  storage_unavailable: "El documento cifrado no pudo recuperarse o descifrarse.",
  integrity_failure: "El PDF almacenado no superó la comprobación SHA-256 y no se entregó.",
  internal_error: "Error inesperado del servidor.",
};

export function messageFor(error: unknown, fallback = "No fue posible completar la operación."): string {
  if (error instanceof ApiError) {
    if (error.code === "conflict" || error.code === "validation_failed") return translateConflict(error.message) ?? fallback;
    return MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}

/** Known conflict messages from the API mapped to Spanish copy. */
function translateConflict(message: string): string | undefined {
  const known: Array<[RegExp, string]> = [
    [/already revoked/i, "La credencial ya estaba revocada."],
    [/cannot be deleted/i, "Una credencial anclada en blockchain no puede eliminarse; solo revocarse."],
    [/controlled by blockchain/i, "El estado de esta credencial lo gobierna la blockchain y no admite cambios manuales."],
    [/anchoring is still in progress/i, "El anclaje blockchain sigue en curso. Sincronízalo antes de revocar."],
    [/reason is required/i, "Indica un motivo para reactivar una credencial revocada."],
    [/not allowed/i, "Esa transición de estado no está permitida."],
    [/evidence cannot be replaced/i, "La evidencia de una credencial vigente o anclada no puede regenerarse."],
    [/Demo credentials are never anchored/i, "Las credenciales demo nunca se anclan en blockchain."],
    [/holder wallet/i, "Introduce la dirección de la wallet del titular para emitir en modo blockchain."],
    [/Invalid certificate payload/i, "Revisa los campos marcados del formulario."],
  ];
  return known.find(([pattern]) => pattern.test(message))?.[1];
}

let tokenProvider: () => string | null = () => null;
let onSessionInvalid: (code: ApiErrorCode) => void = () => undefined;

export function configureApiClient(options: { getToken: () => string | null; onSessionInvalid: (code: ApiErrorCode) => void }) {
  tokenProvider = options.getToken;
  onSessionInvalid = options.onSessionInvalid;
}

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Return the raw Response (used for binary downloads). */
  raw?: boolean;
}

export async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const controller = new AbortController();
  const timeout = window.setTimeout(() => controller.abort(new DOMException("timeout", "TimeoutError")), options.timeoutMs ?? 15_000);
  const forwardAbort = () => controller.abort(options.signal?.reason);
  options.signal?.addEventListener("abort", forwardAbort);

  const headers = new Headers({ Accept: "application/json" });
  if (options.body !== undefined) headers.set("Content-Type", "application/json");
  const token = options.auth === false ? null : tokenProvider();
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${API_URL}${path}`, {
      method: options.method ?? "GET",
      headers,
      body: options.body === undefined ? undefined : JSON.stringify(options.body),
      signal: controller.signal,
    });
  } catch (error) {
    if (options.signal?.aborted) throw error;
    if (controller.signal.aborted) throw new ApiError("timeout", MESSAGES.timeout!);
    throw new ApiError("network", MESSAGES.network!);
  } finally {
    window.clearTimeout(timeout);
    options.signal?.removeEventListener("abort", forwardAbort);
  }

  if (options.raw && response.ok) return response as unknown as T;

  let body: unknown = null;
  const text = await response.text();
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      throw new ApiError("invalid_response", MESSAGES.invalid_response!, response.status);
    }
  }

  if (!response.ok) {
    const payload = (body ?? {}) as { code?: ApiErrorCode; error?: string; details?: ApiError["details"] };
    const code: ApiErrorCode =
      payload.code ??
      (response.status === 401 ? "unauthenticated" : response.status === 403 ? "forbidden" : response.status === 404 ? "not_found" : "unknown");
    if (token && (code === "session_expired" || code === "unauthenticated")) onSessionInvalid(code);
    throw new ApiError(code, payload.error ?? `HTTP ${response.status}`, response.status, payload.details, body);
  }

  return body as T;
}
