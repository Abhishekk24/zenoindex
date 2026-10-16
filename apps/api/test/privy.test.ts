import { getAddress } from "viem";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { accountEmail, accountWallet, type PrivyAuth } from "../src/privy";
import { fakeClient, makeApp, seedProject, testDb } from "./helpers";

const client = fakeClient((method) => {
  throw new Error(`unexpected RPC call: ${method}`);
});

const WALLET = getAddress("0x1111111111111111111111111111111111111111");
// Stands in for Privy's server-side verification: token → embedded wallet.
const EXTERNAL = getAddress("0x4444444444444444444444444444444444444444");
const privy: PrivyAuth = {
  async walletOf(token) {
    if (token === "good") return { wallet: WALLET, email: "a@b.co" };
    if (token === "wallet-user") return { wallet: EXTERNAL, email: null };
    if (token === "no-wallet-yet") return { wallet: null, email: null };
    return null;
  },
};

let db: Db;
let pk: string;

beforeEach(async () => {
  db = await testDb();
  ({ pk } = await seedProject(db));
});

describe("POST /auth/privy", () => {
  it("signs in the Privy user's embedded wallet and returns a working session", async () => {
    const { call } = makeApp(db, client, { privy });
    const r = await call("/auth/privy", { key: pk, body: { accessToken: "good" } });
    expect(r.status).toBe(200);
    expect(r.headers.get("set-cookie")).toContain("dtf_session=");
    const me = await call("/auth/me", { key: pk, token: r.json.token });
    expect(me.json.user.wallets[0].address.toLowerCase()).toBe(WALLET.toLowerCase());
    // The email Privy verified is stored on first sign-in.
    expect(me.json.user.email).toBe("a@b.co");
    expect(me.json.user.emailVerified).toBe(true);

    // Same Privy user again → same account.
    const again = await call("/auth/privy", { key: pk, body: { accessToken: "good" } });
    expect(again.json.user.id).toBe(r.json.user.id);
  });

  it("rejects an invalid or expired token", async () => {
    const { call } = makeApp(db, client, { privy });
    const r = await call("/auth/privy", { key: pk, body: { accessToken: "forged" } });
    expect(r.status).toBe(401);
  });

  it("asks to retry while the embedded wallet is still being created", async () => {
    const { call } = makeApp(db, client, { privy });
    const r = await call("/auth/privy", { key: pk, body: { accessToken: "no-wallet-yet" } });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("wallet_not_ready");
  });

  it("is unavailable when Privy isn't configured", async () => {
    const { call } = makeApp(db, client);
    const r = await call("/auth/privy", { key: pk, body: { accessToken: "good" } });
    expect(r.status).toBe(503);
  });

  it("requires the API key", async () => {
    const { call } = makeApp(db, client, { privy });
    const r = await call("/auth/privy", { body: { accessToken: "good" } });
    expect(r.status).toBe(401);
  });
});

describe("POST /auth/email", () => {
  it("lets a wallet sign-in add an (unverified) email, which a later Privy email overrides", async () => {
    const { call } = makeApp(db, client, { privy });
    const { json } = await call("/auth/privy", { key: pk, body: { accessToken: "wallet-user" } });
    expect(json.user.email).toBeNull();

    const bad = await call("/auth/email", { key: pk, token: json.token, body: { email: "not-an-email" } });
    expect(bad.status).toBe(400);

    const r = await call("/auth/email", { key: pk, token: json.token, body: { email: "Me@Example.com" } });
    expect(r.status).toBe(200);
    expect(r.json.user.email).toBe("me@example.com");
    expect(r.json.user.emailVerified).toBe(false);
  });

  it("refuses to change an email the sign-in method verified", async () => {
    const { call } = makeApp(db, client, { privy });
    const { json } = await call("/auth/privy", { key: pk, body: { accessToken: "good" } });
    const r = await call("/auth/email", { key: pk, token: json.token, body: { email: "other@b.co" } });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("email_locked");
  });
});

describe("accountWallet", () => {
  const embedded = { type: "wallet", chain_type: "ethereum", connector_type: "embedded", address: "0x2222222222222222222222222222222222222222", wallet_index: 0 };
  const external = { type: "wallet", chain_type: "ethereum", connector_type: "injected", address: "0x3333333333333333333333333333333333333333" };
  const email = { type: "email", address: "a@b.co" };

  it("prefers the embedded wallet (email / Google users keep their account if they link a wallet)", () => {
    expect(accountWallet([email, external, embedded])).toBe(getAddress(embedded.address));
  });

  it("uses the external wallet for wallet sign-ins (no embedded wallet)", () => {
    expect(accountWallet([external])).toBe(getAddress(external.address));
  });

  it("ignores non-Ethereum and non-wallet accounts", () => {
    expect(accountWallet([email, { type: "wallet", chain_type: "solana", address: "So1ana" }])).toBeNull();
  });
});

describe("accountEmail", () => {
  it("takes the email account, else the Google one, lowercased; null for a wallet-only user", () => {
    expect(accountEmail([{ type: "email", address: "A@B.co" }, { type: "google_oauth", email: "g@b.co" }])).toBe("a@b.co");
    expect(accountEmail([{ type: "google_oauth", email: "G@b.co" }])).toBe("g@b.co");
    expect(accountEmail([{ type: "wallet", chain_type: "ethereum", address: "0x3333333333333333333333333333333333333333" }])).toBeNull();
  });
});
