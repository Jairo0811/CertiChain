import { createHash } from "node:crypto";
import { CertificateRecord } from "./domain.js";

const students = [
  "Ana Pérez · Demo",
  "Luis Martínez · Demo",
  "Sofía Ramírez · Demo",
  "Carlos Gómez · Demo",
  "Elena Rodríguez · Demo",
  "Miguel Santos · Demo",
  "Valentina Cruz · Demo",
  "Jorge Herrera · Demo",
  "Camila Torres · Demo",
  "Diego Castillo · Demo",
  "María Fernández · Demo",
  "José Núñez · Demo",
  "Laura Méndez · Demo",
  "Andrés Vargas · Demo",
  "Paola Reyes · Demo",
  "Ricardo Peña · Demo",
  "Gabriela Morales · Demo",
  "Fernando Díaz · Demo",
  "Natalia Ortiz · Demo",
  "Samuel Rojas · Demo",
  "Isabella León · Demo",
  "David Acosta · Demo",
  "Emma Guerrero · Demo",
  "Mateo Cabrera · Demo",
] as const;

const titles = [
  "Ingeniería de Software",
  "Ciberseguridad Aplicada",
  "Ciencia de Datos",
  "Desarrollo Web Full Stack",
  "Arquitectura de Software",
  "Fundamentos de Blockchain",
  "Seguridad de Aplicaciones",
  "Analítica de Datos",
  "Cloud Computing",
  "DevOps Foundations",
  "Bases de Datos Avanzadas",
  "Ingeniería de Requisitos",
  "Pruebas de Software",
  "UX Engineering",
  "Gestión de Proyectos TI",
  "Inteligencia Artificial Aplicada",
  "Sistemas Distribuidos",
  "Programación Avanzada",
  "Calidad de Software",
  "APIs y Microservicios",
  "Criptografía Aplicada",
  "Desarrollo Móvil",
  "Gobernanza de TI",
  "Integración de Aplicaciones",
] as const;

const institutions = [
  "Universidad Demo del Caribe",
  "Instituto Tecnológico Demo",
  "Academia CertiChain Demo",
] as const;

function sha256(value: string): string {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(seed: string): string {
  const bytes = Buffer.from(sha256(seed).slice(0, 32), "hex");
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20, 32)}`;
}

export function buildDemoCertificates(): CertificateRecord[] {
  return students.map((studentName, position) => {
    const index = position + 1;
    const status: CertificateRecord["status"] = index <= 21 ? "active" : index <= 23 ? "revoked" : "pending";
    const issuedAt = new Date(Date.UTC(2026, 7, index + 1));
    const createdAt = new Date(Date.UTC(2026, 7, index + 1, 12));
    const revokedAt = status === "revoked" ? new Date(Date.UTC(2026, 8, index - 21, 15)).toISOString() : undefined;

    return {
      id: deterministicUuid(`certichain-demo-${index}`),
      blockchainId: status === "pending" ? undefined : `DEMO-${String(index).padStart(4, "0")}`,
      studentName,
      studentWallet: `0x${sha256(`certichain-demo-wallet-${index}`).slice(-40)}`,
      title: titles[position]!,
      institution: institutions[position % institutions.length]!,
      issuedAt: issuedAt.toISOString().slice(0, 10),
      documentHash: `0x${sha256(`certichain-demo-document-${index}`)}`,
      metadataURI: `ipfs://demo.certichain.local/${String(index).padStart(4, "0")}`,
      status,
      issuerEmail: "portfolio-demo@certichain.local",
      createdAt: createdAt.toISOString(),
      revokedAt,
    };
  });
}

export const demoVerificationSample = (() => {
  const certificate = buildDemoCertificates()[0]!;
  return {
    id: certificate.blockchainId ?? certificate.id,
    hash: certificate.documentHash,
  };
})();
