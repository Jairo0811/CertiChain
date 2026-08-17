import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  JWT_SECRET: z.string().min(16).default("change-me-development-secret"),
  ADMIN_EMAIL: z.string().email().default("admin@certichain.local"),
  ADMIN_PASSWORD: z.string().min(8).default("CertiChain123!"),
  BLOCKCHAIN_RPC_URL: z.string().optional(),
  CERTIFICATE_REGISTRY_ADDRESS: z.string().optional(),
  BLOCKCHAIN_PRIVATE_KEY: z.string().optional(),
});

export const config = schema.parse(process.env);
