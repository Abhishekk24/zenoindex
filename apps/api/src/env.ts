import { z } from "zod";

const schema = z.object({
  DATABASE_URL: z.string().min(1),
  RPC_URL: z.url().default("https://rpc.mainnet.chain.robinhood.com"),
  PORT: z.coerce.number().int().positive().default(8787),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
});

export type Env = z.infer<typeof schema>;

/** Fails fast at boot with every missing/invalid variable listed. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const r = schema.safeParse(source);
  if (!r.success) throw new Error(`invalid environment:\n${z.prettifyError(r.error)}`);
  return r.data;
}
