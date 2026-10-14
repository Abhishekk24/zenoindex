import { z } from "zod";

const sha256Hex = z.string().regex(/^[0-9a-f]{64}$/, "must be a lowercase sha256 hex digest");

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  /** PEM CA certificate of the DB server (private-CA managed Postgres). `\n` escapes are accepted for one-line .env files. */
  DATABASE_CA_CERT: z.string().includes("BEGIN CERTIFICATE").optional(),
  RPC_URL: z.url().default("https://rpc.mainnet.chain.robinhood.com"),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  /** Public https URL of this API; used as the SIWE domain/uri of the seeded project. */
  PUBLIC_URL: z.url().optional(),
  // Optional first-boot seed: one project + its keys, given only as SHA-256 hashes so the raw keys never sit in deploy config.
  // Didit KYC (optional: without key + workflow, starting KYC returns 503 "not set up yet").
  DIDIT_API_KEY: z.string().min(1).optional(),
  DIDIT_WORKFLOW_ID: z.string().min(1).optional(),
  DIDIT_WEBHOOK_SECRET: z.string().min(1).optional(),
  DIDIT_CALLBACK_URL: z.url().optional(),
  // Privy email / Google sign-in for the mobile app (optional: without both, POST /auth/privy returns 503). Secret stays server-side.
  PRIVY_APP_ID: z.string().min(1).optional(),
  PRIVY_APP_SECRET: z.string().min(1).optional(),
  SEED_PROJECT_NAME: z.string().min(1).optional(),
  SEED_PUBLISHABLE_KEY_SHA256: sha256Hex.optional(),
  SEED_SECRET_KEY_SHA256: sha256Hex.optional(),
});

export type Env = z.infer<typeof schema>;

/** Fails fast at boot with every missing/invalid variable listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) throw new Error(`invalid environment:\n${z.prettifyError(r.error)}`);
  return r.data;
}
