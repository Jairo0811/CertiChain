import "dotenv/config";
import { z } from "zod";

const DEVELOPMENT_JWT_SECRET = "change-me-development-secret";
const DEVELOPMENT_ADMIN_PASSWORD = "CertiChain123!";

const optionalUrl = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().url().optional(),
);

const optionalString = z.preprocess(
  (value) => (value === "" || value == null ? undefined : value),
  z.string().optional(),
);

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    JWT_SECRET: z.string().min(16).default(DEVELOPMENT_JWT_SECRET),
    ADMIN_EMAIL: z.string().email().default("admin@certichain.local"),
    ADMIN_PASSWORD: z.string().min(8).default(DEVELOPMENT_ADMIN_PASSWORD),
    DATABASE_URL: optionalUrl,
    CERTICHAIN_DATA_FILE: z.string().min(1).default(".data/certichain.json"),
    BLOCKCHAIN_RPC_URL: optionalUrl,
    CERTIFICATE_REGISTRY_ADDRESS: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    ),
    BLOCKCHAIN_PRIVATE_KEY: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
    ),
    STORAGE_DRIVER: z.enum(["local", "ipfs"]).default("local"),
    DOCUMENT_ENCRYPTION_KEY: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.string().regex(/^[a-fA-F0-9]{64}$/).optional(),
    ),
    IPFS_API_URL: optionalUrl,
    IPFS_API_TOKEN: optionalString,
    METRICS_TOKEN: z.preprocess(
      (value) => (value === "" || value == null ? undefined : value),
      z.string().min(16).optional(),
    ),
  })
  .superRefine((value, ctx) => {
    if (value.STORAGE_DRIVER === "ipfs" && !value.IPFS_API_URL) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["IPFS_API_URL"],
        message: "IPFS_API_URL is required when STORAGE_DRIVER=ipfs",
      });
    }

    if (value.NODE_ENV !== "production") return;

    if (value.JWT_SECRET === DEVELOPMENT_JWT_SECRET) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["JWT_SECRET"], message: "Production requires a unique JWT secret" });
    }

    if (value.ADMIN_PASSWORD === DEVELOPMENT_ADMIN_PASSWORD) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["ADMIN_PASSWORD"], message: "Production requires a unique admin password" });
    }

    if (value.CORS_ORIGIN.includes("localhost")) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["CORS_ORIGIN"], message: "Production CORS origin cannot use localhost" });
    }

    const requiredProductionValues: Array<[keyof typeof value, unknown, string]> = [
      ["DATABASE_URL", value.DATABASE_URL, "Production requires PostgreSQL persistence"],
      ["DOCUMENT_ENCRYPTION_KEY", value.DOCUMENT_ENCRYPTION_KEY, "Production requires a dedicated AES-256 document encryption key"],
      ["BLOCKCHAIN_RPC_URL", value.BLOCKCHAIN_RPC_URL, "Production requires a blockchain RPC endpoint"],
      ["CERTIFICATE_REGISTRY_ADDRESS", value.CERTIFICATE_REGISTRY_ADDRESS, "Production requires a deployed CertificateRegistry address"],
      ["BLOCKCHAIN_PRIVATE_KEY", value.BLOCKCHAIN_PRIVATE_KEY, "Production requires a dedicated issuer signer key"],
      ["METRICS_TOKEN", value.METRICS_TOKEN, "Production requires protected metrics access"],
    ];

    for (const [path, currentValue, message] of requiredProductionValues) {
      if (!currentValue) ctx.addIssue({ code: z.ZodIssueCode.custom, path: [path], message });
    }

    if (value.STORAGE_DRIVER !== "ipfs") {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["STORAGE_DRIVER"],
        message: "Production requires STORAGE_DRIVER=ipfs",
      });
    }
  });

export const config = schema.parse(process.env);
