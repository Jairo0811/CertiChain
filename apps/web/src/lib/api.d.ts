export declare const API_URL: string;
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
export declare class ApiError extends Error {
  readonly code: ApiErrorCode;
  readonly status: number;
  readonly details?:
    | {
        fieldErrors?: Record<string, string[]>;
      }
    | undefined;
  readonly body?: unknown | undefined;
  constructor(
    code: ApiErrorCode,
    message: string,
    status?: number,
    details?:
      | {
          fieldErrors?: Record<string, string[]>;
        }
      | undefined,
    body?: unknown | undefined,
  );
}
export declare function messageFor(error: unknown, fallback?: string): string;
export declare function configureApiClient(options: {
  getToken: () => string | null;
  onSessionInvalid: (code: ApiErrorCode) => void;
}): void;
interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  body?: unknown;
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
  /** Return the raw Response (used for binary downloads). */
  raw?: boolean;
}
export declare function request<T>(path: string, options?: RequestOptions): Promise<T>;
export {};
