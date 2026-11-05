import { getAddress, isAddress, ZeroAddress } from "ethers";
import { z } from "zod";

export const hashSchema = z.string().regex(/^0x[a-fA-F0-9]{64}$/, "Expected a 0x-prefixed SHA-256 hash");

/** Certificate UUIDs, on-chain bytes32 ids and demo ids (DEMO-0001). */
export const idSchema = z
  .string()
  .trim()
  .min(1)
  .max(128)
  .regex(/^[A-Za-z0-9_-]+$/, "Invalid certificate identifier");

const trimmedText = (min: number, max: number) =>
  z
    .string()
    .transform((value) => value.trim().replace(/\s+/g, " "))
    .pipe(z.string().min(min).max(max));

/** EVM address, validated (including EIP-55 checksum when mixed case) and normalized. */
export const walletSchema = z
  .string()
  .trim()
  .refine((value) => /^0x[a-fA-F0-9]{40}$/.test(value) && isAddress(value), "Invalid EVM address or checksum")
  .transform((value) => getAddress(value))
  .refine((value) => value !== ZeroAddress, "The zero address cannot hold a credential");

const issuedAtSchema = z
  .string()
  .date()
  .refine((value) => value >= "1900-01-01", "Issue date is too old")
  .refine((value) => {
    // Allow today in any timezone (UTC+14) but nothing beyond.
    const limit = new Date(Date.now() + 86_400_000).toISOString().slice(0, 10);
    return value <= limit;
  }, "Issue date cannot be in the future");

export const issueSchema = z
  .object({
    studentName: trimmedText(2, 160),
    studentWallet: z.preprocess((value) => (value === "" ? undefined : value), walletSchema.optional()),
    title: trimmedText(2, 200),
    institution: trimmedText(2, 200),
    issuedAt: issuedAtSchema,
    documentHash: hashSchema.optional(),
    metadataURI: z
      .string()
      .max(500)
      .regex(/^(local-encrypted|ipfs):\/\/[A-Za-z0-9._/-]+$/, "Unsupported metadata URI")
      .optional(),
  })
  .strict()
  .superRefine((value, ctx) => {
    if (Boolean(value.documentHash) !== Boolean(value.metadataURI)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["documentHash"],
        message: "documentHash and metadataURI must be supplied together or omitted together",
      });
    }
  });

export const loginSchema = z.object({
  email: z.string().trim().email().max(254),
  password: z.string().min(8).max(256),
});

export const statusChangeSchema = z
  .object({
    status: z.enum(["pending", "active", "revoked"]),
    reason: trimmedText(5, 500).optional(),
  })
  .strict();

export const revokeSchema = z
  .object({ reason: trimmedText(5, 500).optional() })
  .strict()
  .optional();

export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).optional(),
  pageSize: z.coerce.number().int().min(1).max(100).optional(),
  search: z.string().trim().max(120).optional(),
  status: z.enum(["pending", "active", "revoked"]).optional(),
  sort: z.enum(["createdAt", "issuedAt", "studentName", "title", "institution", "status"]).optional(),
  direction: z.enum(["asc", "desc"]).optional(),
});

export const dashboardQuerySchema = z.object({
  range: z.enum(["30", "90", "365", "all"]).default("30"),
});

export const auditQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(1000).optional(),
  entityId: idSchema.optional(),
});
