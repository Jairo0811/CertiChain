import type { ConnectionState, Verification } from "../types";

export const API_URL = process.env.EXPO_PUBLIC_API_URL?.trim() ?? "";
export const PUBLIC_VERIFY_URL = process.env.EXPO_PUBLIC_VERIFY_URL?.trim() || "certichain://verify";

export type ApiErrorCode = "unconfigured" | "timeout" | "network" | "not_found" | "invalid_response" | "request_failed";

export class MobileApiError extends Error {
  constructor(
    public readonly code: ApiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "MobileApiError";
  }
}

type EvidenceLookup = { documentHash: string };

type Health = {
  status: string;
  blockchainConfigured?: boolean;
};

function configuredApiUrl(): string {
  if (!API_URL) {
    throw new MobileApiError(
      "unconfigured",
      "Configura EXPO_PUBLIC_API_URL para verificar credenciales desde este dispositivo.",
    );
  }
  return API_URL.replace(/\/$/, "");
}

async function requestJson<T>(path: string, timeoutMs = 8000): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(`${configuredApiUrl()}${path}`, { signal: controller.signal });
    let body: unknown;
    try {
      body = await response.json();
    } catch {
      throw new MobileApiError("invalid_response", "CertiChain respondió con un formato no válido.");
    }

    if (!response.ok) {
      if (response.status === 404) {
        throw new MobileApiError("not_found", "No se encontró una credencial con ese ID.");
      }
      throw new MobileApiError("request_failed", "CertiChain no pudo completar la verificación.");
    }

    return body as T;
  } catch (error) {
    if (error instanceof MobileApiError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new MobileApiError("timeout", "La API tardó demasiado en responder. Inténtalo de nuevo.");
    }
    throw new MobileApiError("network", "No fue posible conectar con la API de CertiChain.");
  } finally {
    clearTimeout(timeout);
  }
}

function isHash(value: unknown): value is string {
  return typeof value === "string" && /^0x[a-fA-F0-9]{64}$/.test(value);
}

function isVerification(value: unknown): value is Verification {
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<Verification>;
  return typeof candidate.valid === "boolean";
}

export async function verifyCredential(
  id: string,
  suppliedHash?: string,
): Promise<{ verification: Verification; documentHash: string }> {
  let documentHash = suppliedHash?.trim() ?? "";

  if (!documentHash) {
    const evidence = await requestJson<EvidenceLookup>(`/api/verify/${encodeURIComponent(id)}/evidence`);
    if (!isHash(evidence.documentHash)) {
      throw new MobileApiError("invalid_response", "La evidencia SHA-256 recibida no es válida.");
    }
    documentHash = evidence.documentHash;
  }

  const verification = await requestJson<Verification>(
    `/api/verify/${encodeURIComponent(id)}?hash=${encodeURIComponent(documentHash)}`,
  );
  if (!isVerification(verification)) {
    throw new MobileApiError("invalid_response", "El resultado de verificación recibido no es válido.");
  }

  return { verification, documentHash };
}

export async function checkApiConnection(): Promise<{
  state: ConnectionState;
  blockchainConfigured: boolean | null;
}> {
  if (!API_URL) return { state: "unconfigured", blockchainConfigured: null };
  try {
    const health = await requestJson<Health>("/health", 4000);
    return {
      state: health.status === "ok" ? "connected" : "offline",
      blockchainConfigured: typeof health.blockchainConfigured === "boolean" ? health.blockchainConfigured : null,
    };
  } catch {
    return { state: "offline", blockchainConfigured: null };
  }
}
