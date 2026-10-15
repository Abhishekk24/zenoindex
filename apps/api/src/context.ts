import type { Context } from "hono";
import type { PublicClient } from "viem";
import { z } from "zod";
import type { Db } from "./db";
import type { DiditConfig } from "./didit";
import type { LogoSource } from "./logos";
import type { PrivyAuth } from "./privy";
import { badRequest, unauthorized } from "./errors";
import type { KeyType, Project } from "./tenancy";
import type { UserRow } from "./users";

export type Deps = { db: Db; client: PublicClient; secureCookies: boolean; didit?: DiditConfig; privy?: PrivyAuth; logos?: LogoSource };
export type AppEnv = { Variables: { project: Project; keyType: KeyType; user: UserRow | null; sessionToken: string | null } };
export type Ctx = Context<AppEnv>;

export function requireUser(c: Ctx) {
  const user = c.get("user");
  if (!user) throw unauthorized();
  return user;
}

export async function parseBody<T extends z.ZodType>(c: Ctx, schema: T): Promise<z.infer<T>> {
  const raw = await c.req.json().catch(() => ({}));
  const r = schema.safeParse(raw);
  if (!r.success) {
    const issue = r.error.issues[0];
    throw badRequest("validation_failed", issue ? `${issue.path.join(".") || "body"}: ${issue.message}` : "Invalid request.");
  }
  return r.data;
}

export const address = z.string().regex(/^0x[0-9a-fA-F]{40}$/, "must be a 0x address").transform((s) => s.toLowerCase() as `0x${string}`);
export const txHash = z.string().regex(/^0x[0-9a-fA-F]{64}$/, "must be a transaction hash").transform((s) => s.toLowerCase() as `0x${string}`);
/** Human decimal amount with at most 6 decimals (USDG and share tokens are both 6-decimal). */
export const amount6 = z.string().regex(/^\d+(\.\d{1,6})?$/, "must be a positive amount with up to 6 decimals");
