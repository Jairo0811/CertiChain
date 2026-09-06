import { createCipheriv, createDecipheriv, createHash, randomBytes, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
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

  async readDocument(metadataURI: string): Promise<Buffer> {
    let encrypted: Buffer;

    if (metadataURI.startsWith("local-encrypted://")) {
      const filename = metadataURI.slice("local-encrypted://".length);
      if (!/^[a-zA-Z0-9._-]+$/.test(filename)) throw new Error("Invalid local document reference");
      encrypted = await readFile(resolve(process.cwd(), ".data/documents", filename));
    } else if (metadataURI.startsWith("ipfs://")) {
      encrypted = await downloadFromIpfs(metadataURI.slice("ipfs://".length));
    } else {
      throw new Error("Certificate document is not managed by CertiChain storage");
    }

    return decrypt(encrypted);
  }

  canReadDocument(metadataURI: string): boolean {
    if (metadataURI.startsWith("local-encrypted://")) return true;
    return metadataURI.startsWith("ipfs://") && Boolean(config.IPFS_API_URL);
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

function decrypt(encrypted: Buffer): Buffer {
  const magic = Buffer.from("CERTICHAIN1", "ascii");
  const minimumLength = magic.length + 12 + 16 + 1;
  if (encrypted.length < minimumLength || !encrypted.subarray(0, magic.length).equals(magic)) {
    throw new Error("Invalid CertiChain encrypted document");
  }

  const ivStart = magic.length;
  const tagStart = ivStart + 12;
  const ciphertextStart = tagStart + 16;
  const iv = encrypted.subarray(ivStart, tagStart);
  const tag = encrypted.subarray(tagStart, ciphertextStart);
  const ciphertext = encrypted.subarray(ciphertextStart);

  const decipher = createDecipheriv("aes-256-gcm", resolveEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
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

  const encryptedArrayBuffer = encrypted.buffer.slice(
    encrypted.byteOffset,
    encrypted.byteOffset + encrypted.byteLength,
  ) as ArrayBuffer;

  const form = new FormData();
  form.append(
    "file",
    new Blob([encryptedArrayBuffer], { type: "application/octet-stream" }),
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

async function downloadFromIpfs(cid: string): Promise<Buffer> {
  if (!config.IPFS_API_URL) throw new Error("IPFS storage is not configured");
  if (!/^[a-zA-Z0-9]+$/.test(cid)) throw new Error("Invalid IPFS CID");

  const endpoint = new URL("api/v0/cat", ensureTrailingSlash(config.IPFS_API_URL));
  endpoint.searchParams.set("arg", cid);

  const headers = new Headers();
  if (config.IPFS_API_TOKEN) headers.set("Authorization", `Bearer ${config.IPFS_API_TOKEN}`);

  const response = await fetch(endpoint, { method: "POST", headers });
  if (!response.ok) throw new Error(`IPFS download failed with HTTP ${response.status}`);
  return Buffer.from(await response.arrayBuffer());
}

function sanitizeFilename(filename: string): string {
  const normalized = filename.trim().replace(/[^a-zA-Z0-9._-]+/g, "-").slice(0, 120);
  return normalized || "certificate";
}

function ensureTrailingSlash(value: string): string {
  return value.endsWith("/") ? value : `${value}/`;
}

export const storageService = new StorageService();
