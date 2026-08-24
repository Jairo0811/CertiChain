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

    if (!value.DATABASE_URL) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ["DATABASE_URL"], message: "Production requires PostgreSQL persistence" });
    }

    if (!value.DOCUMENT_ENCRYPTION_KEY) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["DOCUMENT_ENCRYPTION_KEY"],
        message: "Production requires a dedicated AES-256 document encryption key",
      });
    }
  });

export const config = schema.parse(process.env);
