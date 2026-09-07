export type CredentialReference = {
  id: string;
  hash?: string;
};

function decode(value: string): string {
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch {
    return value;
  }
}

export function parseCredentialReference(value: string): CredentialReference {
  const trimmed = value.trim();
  if (!trimmed) return { id: "" };

  try {
    const url = new URL(trimmed);
    const id = url.searchParams.get("id")?.trim() ?? "";
    const hash = url.searchParams.get("hash")?.trim() || undefined;
    return { id, hash };
  } catch {
    const idMatch = trimmed.match(/[?&]id=([^&#]+)/i);
    if (idMatch?.[1]) {
      const hashMatch = trimmed.match(/[?&]hash=([^&#]+)/i);
      return {
        id: decode(idMatch[1]).trim(),
        hash: hashMatch?.[1] ? decode(hashMatch[1]).trim() : undefined,
      };
    }
    return { id: trimmed };
  }
}

export function buildVerificationUrl(baseUrl: string, id: string): string {
  const normalizedBase = baseUrl.trim() || "certichain://verify";
  try {
    const url = new URL(normalizedBase);
    url.searchParams.set("id", id);
    url.searchParams.set("autoverify", "1");
    return url.toString();
  } catch {
    const separator = normalizedBase.includes("?") ? "&" : "?";
    return `${normalizedBase}${separator}id=${encodeURIComponent(id)}&autoverify=1`;
  }
}

export function buildShareMessage(title: string, institution: string, url: string): string {
  return `${title}\n${institution}\n${url}`;
}
