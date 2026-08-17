import "dotenv/config";
import { z } from "zod";

const DEVELOPMENT_JWT_SECRET = "change-me-development-secret";
const DEVELOPMENT_ADMIN_PASSWORD = "CertiChain123!";

const schema = z
  .object({
    NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
    PORT: z.coerce.number().int().positive().max(65535).default(4000),
    CORS_ORIGIN: z.string().min(1).default("http://localhost:5173"),
    JWT_SECRET: z.string().min(16).default(DEVELOPMENT_JWT_SECRET),
    ADMIN_EMAIL: z.string().email().default("admin@certichain.local"),
    ADMIN_PASSWORD: z.string().min(8).default(DEVELOPMENT_ADMIN_PASSWORD),
    BLOCKCHAIN_RPC_URL: z.string().url().optional(),
    CERTIFICATE_REGISTRY_ADDRESS: z.string().regex(/^0x[a-fA-F0-9]{40}$/).optional(),
    BLOCKCHAIN_PRIVATE_KEY: z.string().regex(/^0x[a-fA-F0-9]{64}$/).optional(),
  })
  .superRefine((value, ctx) => {
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
  });

export const config = schema.parse(process.env);
