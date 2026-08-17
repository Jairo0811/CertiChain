import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { dirname, resolve } from "node:path";
import { AuditEvent, CertificateRecord } from "./domain.js";

interface PersistedState {
  certificates: CertificateRecord[];
  audit: AuditEvent[];
}

const dataFile = resolve(process.cwd(), process.env.CERTICHAIN_DATA_FILE ?? ".data/certichain.json");

export class JsonStore {
  private state: PersistedState = { certificates: [], audit: [] };
  private initialized = false;

  async init(): Promise<void> {
    if (this.initialized) return;
    await mkdir(dirname(dataFile), { recursive: true });

    try {
      this.state = JSON.parse(await readFile(dataFile, "utf8")) as PersistedState;
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "ENOENT") throw error;
      await this.persist();
    }

    this.initialized = true;
  }

  async listCertificates(): Promise<CertificateRecord[]> {
    await this.init();
    return [...this.state.certificates].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  async getCertificate(id: string): Promise<CertificateRecord | undefined> {
    await this.init();
    return this.state.certificates.find((certificate) => certificate.id === id || certificate.blockchainId === id);
  }

  async saveCertificate(certificate: CertificateRecord): Promise<void> {
    await this.init();
    const index = this.state.certificates.findIndex((current) => current.id === certificate.id);
    if (index >= 0) this.state.certificates[index] = certificate;
    else this.state.certificates.push(certificate);
    await this.persist();
  }

  async appendAudit(event: AuditEvent): Promise<void> {
    await this.init();
    this.state.audit.push(event);
    await this.persist();
  }

  async listAudit(): Promise<AuditEvent[]> {
    await this.init();
    return [...this.state.audit].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private async persist(): Promise<void> {
    const tempFile = `${dataFile}.tmp`;
    await writeFile(tempFile, JSON.stringify(this.state, null, 2), "utf8");
    await rename(tempFile, dataFile);
  }
}

export const store = new JsonStore();
