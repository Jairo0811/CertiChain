import { createCipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import { resolve } from "node:path";
import { config } from "./config.js";

export interface StoredDocument {
  documentHash: string;
  metadataURI: string;
  encryption: "AES-256-GCM";
  encryptedBytes: number;
}

class StorageService {
  readonly driver = config.STORAGE_DRIVER;

  async saveDocument(input: Buffer, filename: string, mimeType: string): Promise<StoredDocument> {
    if (input.length === 0) throw new Error("Document is empty");

    const documentHash = `0x${createHash("sha256").update(input).digest("hex")}`;
    const encrypted = encrypt(input);
    const safeFilename = sanitizeFilename(filename);

    const metadataURI = this.driver === "ipfs"
      ? await uploadToIpfs(encrypted, `${safeFilename}.enc`, mimeType)
      : await saveLocally(encrypted, `${randomUUID()}-${safeFilename}.enc`);

    return {
      documentHash,
      metadataURI,
      encryption: "AES-256-GCM",
      encryptedBytes: encrypted.length,
    };
  }

  get configured(): boolean {
    return this.driver === "local" || Boolean(config.IPFS_API_URL);
  }
}

function resolveEncryptionKey(): Buffer {
  if (config.DOCUMENT_ENCRYPTION_KEY) {
    return Buffer.from(config.DOCUMENT_ENCRYPTION_KEY, "hex");
  }

  // Development/test fallback only. Production configuration requires a dedicated key.
  return createHash("sha256").update(`certichain-document-key:${config.JWT_SECRET}`).digest();
}

function encrypt(plaintext: Buffer): Buffer {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", resolveEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  const magic = Buffer.from("CERTICHAIN1", "ascii");
  return Buffer.concat([magic, iv, tag, ciphertext]);
}

async function saveLocally(encrypted: Buffer, filename: string): Promise<string> {
  const directory = resolve(process.cwd(), ".data/documents");
  await mkdir(directory, { recursive: true });
  const absolute = resolve(directory, filename);
  await writeFile(absolute, encrypted);
  return `local-encrypted://${filename}`;
}

async function uploadToIpfs(encrypted: Buffer, filename: string, originalMimeType: string): Promise<string> {
  if (!config.IPFS_API_URL) throw new Error("IPFS storage is not configured");

  const endpoint = new URL("api/v0/add", ensureTrailingSlash(config.IPFS_API_URL));
  endpoint.searchParams.set("pin", "true");
  endpoint.searchParams.set("cid-version", "1");

  const form = new FormData();
  form.append(
    "file",
    new Blob([encrypted], { type: "application/octet-stream" }),
    filename,
  );
  form.append("originalContentType", originalMimeType);

  const headers = new Headers();
  if (config.IPFS_API_TOKEN) headers.set("Authorization", `Bearer ${config.IPFS_API_TOKEN}`);

  const response = await fetch(endpoint, { method: "POST", body: form, headers });
  if (!response.ok) {
    throw new Error(`IPFS upload failed with HTTP ${response.status}`);
  }

  const payload = (await response.json()) as { Hash?: string };
  if (!payload.Hash) throw new Error("IPFS response did not include a CID");
  return `ipfs://${payload.Hash}`;
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  return normalized || "certificate";
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export const storageService = new StorageService();
