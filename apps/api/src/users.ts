import { randomBytes } from "node:crypto";
import type { Db } from "./db";
import { sha256 } from "./tenancy";

export const SESSION_COOKIE = "dtf_session";
export const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

export type UserRow = {
  id: string;
  project_id: string;
  wallet_address: string;
  first_name: string | null;
  last_name: string | null;
  display_name: string | null;
  country: string | null;
  email: string | null;
  /** Set when the email came from the sign-in method (Privy verified it); null for one typed in Profile. */
  email_verified_at: Date | null;
  terms_accepted_at: Date | null;
  privacy_accepted_at: Date | null;
  created_at: Date;
};

const iso = (d: Date | string | null) => (d === null ? null : new Date(d).toISOString());

/** The `user` object the mobile app reads (zenoIndex-mobile-app/src/lib/adapters.ts toUser). */
export function publicUser(u: UserRow, chainId: number) {
  return {
    id: u.id,
    email: u.email,
    emailVerified: u.email_verified_at !== null,
    displayName: u.display_name,
    firstName: u.first_name,
    lastName: u.last_name,
    country: u.country,
    walletAddress: u.wallet_address,
    wallets: [{ address: u.wallet_address, chainId, isPrimary: true }],
    twoFactorEnabled: false,
    termsAcceptedAt: iso(u.terms_accepted_at),
    privacyAcceptedAt: iso(u.privacy_accepted_at),
    createdAt: iso(u.created_at),
  };
}

/** `email` is one the sign-in method verified (Privy): it is stored as verified and replaces a typed-in one. */
export async function upsertUserByWallet(db: Db, projectId: string, wallet: string, email: string | null = null) {
  const { rows } = await db.query<UserRow>(
    `insert into users (project_id, wallet_address, email, email_verified_at)
     values ($1, $2, $3, case when $3::text is null then null else now() end)
     on conflict (project_id, wallet_address) do update set
       email = coalesce(excluded.email, users.email),
       email_verified_at = coalesce(excluded.email_verified_at, users.email_verified_at),
       updated_at = users.updated_at
     returning *`,
    [projectId, wallet.toLowerCase(), email],
  );
  return rows[0]!;
}

export async function createSession(db: Db, user: UserRow) {
  const token = randomBytes(32).toString("base64url");
  await db.query(
    "insert into sessions (token_hash, user_id, project_id, expires_at) values ($1, $2, $3, now() + make_interval(secs => $4))",
    [sha256(token), user.id, user.project_id, SESSION_TTL_SECONDS],
  );
  return token;
}

/** Session must belong to the same project as the API key — a token from one app can't be used with another app's key. */
export async function userForSession(db: Db, projectId: string, token: string) {
  const { rows } = await db.query<UserRow>(
    `select u.* from sessions s join users u on u.id = s.user_id
     where s.token_hash = $1 and s.project_id = $2 and s.expires_at > now()`,
    [sha256(token), projectId],
  );
  return rows[0] ?? null;
}

export const deleteSession = (db: Db, token: string) => db.query("delete from sessions where token_hash = $1", [sha256(token)]);

export function sessionCookie(token: string, secure: boolean) {
  const flags = `Path=/; HttpOnly; SameSite=Lax; Max-Age=${token ? SESSION_TTL_SECONDS : 0}${secure ? "; Secure" : ""}`;
  return `${SESSION_COOKIE}=${token}; ${flags}`;
}

/** `Authorization: Bearer <token>` or the `dtf_session` cookie (what the mobile app sends today). */
export function sessionToken(authorization: string | undefined, cookie: string | undefined) {
  const bearer = authorization?.match(/^Bearer\s+(.+)$/i)?.[1];
  if (bearer) return bearer.trim();
  return cookie?.match(new RegExp(`(?:^|;\\s*)${SESSION_COOKIE}=([^;]+)`))?.[1] ?? null;
}
