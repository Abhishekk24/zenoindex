import type { Hono } from "hono";
import { getAddress, recoverMessageAddress, type Hex } from "viem";
import { createSiweMessage, generateSiweNonce, parseSiweMessage, validateSiweMessage } from "viem/siwe";
import { z } from "zod";
import { address, parseBody, requireUser, type AppEnv, type Deps } from "../context";
import { badRequest, unauthorized } from "../errors";
import { createSession, deleteSession, publicUser, sessionCookie, upsertUserByWallet, type UserRow } from "../users";

const NONCE_TTL_SECONDS = 5 * 60;

export function authRoutes(app: Hono<AppEnv>, { db, client, secureCookies }: Deps) {
  // Step 1: server issues a single-use nonce and the exact EIP-4361 message for the wallet to sign.
  app.post("/auth/siwe/nonce", async (c) => {
    const project = c.get("project");
    const { walletAddress, chainId } = await parseBody(
      c,
      z.object({ walletAddress: address, chainId: z.number().int().optional() }),
    );
    if (chainId !== undefined && chainId !== project.chainId) {
      throw badRequest("wrong_chain", `Switch your wallet to chain ${project.chainId} and try again.`);
    }
    const nonce = generateSiweNonce();
    const issuedAt = new Date();
    const expirationTime = new Date(issuedAt.getTime() + NONCE_TTL_SECONDS * 1000);
    await db.query(
      "insert into siwe_nonces (nonce, project_id, wallet_address, chain_id, expires_at) values ($1, $2, $3, $4, $5)",
      [nonce, project.id, walletAddress, project.chainId, expirationTime],
    );
    const message = createSiweMessage({
      domain: project.siweDomain,
      uri: project.siweUri,
      address: getAddress(walletAddress),
      chainId: project.chainId,
      nonce,
      version: "1",
      statement: `Sign in to ${project.name}.`,
      issuedAt,
      expirationTime,
    });
    return c.json({ nonce, message, expiresInSeconds: NONCE_TTL_SECONDS });
  });

  // Step 2: consume the nonce (atomically, so a signature can never be replayed), then check the signature.
  app.post("/auth/siwe/verify", async (c) => {
    const project = c.get("project");
    const { message, signature } = await parseBody(
      c,
      z.object({ message: z.string().min(1).max(4000), signature: z.string().regex(/^0x[0-9a-fA-F]+$/) }),
    );
    const parsed = parseSiweMessage(message);
    if (!parsed.nonce || !parsed.address) throw unauthorized("That sign-in request is invalid. Please try again.");

    const { rows } = await db.query<{ wallet_address: string; chain_id: number }>(
      `update siwe_nonces set used_at = now()
       where nonce = $1 and project_id = $2 and used_at is null and expires_at > now()
       returning wallet_address, chain_id`,
      [parsed.nonce, project.id],
    );
    const issued = rows[0];
    if (!issued) throw unauthorized("That sign-in request expired or was already used. Please try again.");

    const wallet = getAddress(issued.wallet_address);
    const valid =
      parsed.chainId === issued.chain_id &&
      validateSiweMessage({ message: parsed, domain: project.siweDomain, nonce: parsed.nonce, address: wallet });
    if (!valid || !(await signatureMatches(client, wallet, message, signature as Hex))) {
      throw unauthorized("Signature check failed. Please try again.");
    }

    const user = await upsertUserByWallet(db, project.id, wallet);
    const token = await createSession(db, user);
    c.header("Set-Cookie", sessionCookie(token, secureCookies));
    return c.json({ user: publicUser(user, project.chainId), token });
  });

  app.get("/auth/me", (c) => {
    const user = c.get("user");
    return c.json({ user: user ? publicUser(user, c.get("project").chainId) : null });
  });

  app.post("/auth/accept-terms", async (c) => {
    const user = requireUser(c);
    await parseBody(c, z.object({ terms: z.literal(true), privacy: z.literal(true) }));
    const { rows } = await db.query<UserRow>(
      `update users set terms_accepted_at = coalesce(terms_accepted_at, now()),
         privacy_accepted_at = coalesce(privacy_accepted_at, now()), updated_at = now()
       where id = $1 returning *`,
      [user.id],
    );
    return c.json({ user: publicUser(rows[0]!, c.get("project").chainId) });
  });

  app.post("/auth/profile", async (c) => {
    const user = requireUser(c);
    const name = z.string().trim().min(1).max(80);
    const p = await parseBody(
      c,
      z.object({
        firstName: name,
        lastName: name,
        country: z.string().regex(/^[A-Za-z]{2}$/, "must be a 2-letter country code").transform((s) => s.toUpperCase()),
        displayName: z.string().trim().max(160).optional(),
      }),
    );
    const { rows } = await db.query<UserRow>(
      `update users set first_name = $2, last_name = $3, country = $4, display_name = $5, updated_at = now()
       where id = $1 returning *`,
      [user.id, p.firstName, p.lastName, p.country, p.displayName || `${p.firstName} ${p.lastName}`],
    );
    return c.json({ user: publicUser(rows[0]!, c.get("project").chainId) });
  });

  app.post("/auth/logout", async (c) => {
    const token = c.get("sessionToken");
    if (token) await deleteSession(db, token);
    c.header("Set-Cookie", sessionCookie("", secureCookies));
    return c.json({ ok: true });
  });
}

/** EOA signatures are checked offline; anything else (embedded/smart-account wallets, ERC-1271/6492) on-chain. */
async function signatureMatches(client: Deps["client"], wallet: `0x${string}`, message: string, signature: Hex) {
  const recovered = await recoverMessageAddress({ message, signature }).catch(() => null);
  if (recovered === wallet) return true;
  return client.verifyMessage({ address: wallet, message, signature }).catch(() => false);
}
