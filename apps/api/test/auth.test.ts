import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { fakeClient, makeApp, seedProject, testDb } from "./helpers";

// EOA signatures verify offline, so no RPC call should ever happen in these tests.
const client = fakeClient((method) => {
  throw new Error(`unexpected RPC call: ${method}`);
});

let db: Db;
let call: ReturnType<typeof makeApp>["call"];
let pk: string;

beforeEach(async () => {
  db = await testDb();
  ({ pk } = await seedProject(db));
  ({ call } = makeApp(db, client));
});

async function signIn(account = privateKeyToAccount(generatePrivateKey()), key = pk) {
  const nonce = await call("/auth/siwe/nonce", { key, body: { walletAddress: account.address, chainId: 4663 } });
  expect(nonce.status).toBe(200);
  const signature = await account.signMessage({ message: nonce.json.message });
  return { account, message: nonce.json.message as string, signature, res: await call("/auth/siwe/verify", { key, body: { message: nonce.json.message, signature } }) };
}

describe("API key", () => {
  it("is required", async () => {
    const r = await call("/dtfs");
    expect(r.status).toBe(401);
    expect(r.json.error).toMatchObject({ status: 401, code: "unauthorized", retryable: false });
  });

  it("answers browser preflights without a key (Expo web)", async () => {
    const { app } = makeApp(db, client);
    const r = await app.request("/api/v1/auth/siwe/nonce", {
      method: "OPTIONS",
      headers: { origin: "http://localhost:8081", "access-control-request-method": "POST", "access-control-request-headers": "x-api-key,content-type" },
    });
    expect(r.status).toBe(204);
    expect(r.headers.get("access-control-allow-headers")).toContain("x-api-key");
  });

  it("rejects unknown keys", async () => {
    expect((await call("/auth/me", { key: "pk_live_nope" })).status).toBe(401);
  });

  it("rejects revoked keys", async () => {
    await db.query("update api_keys set revoked_at = now()");
    expect((await call("/auth/me", { key: pk })).status).toBe(401);
  });
});

describe("SIWE login", () => {
  it("signs in, returns the app's user shape, and the token works as bearer or cookie", async () => {
    const { account, res } = await signIn();
    expect(res.status).toBe(200);
    expect(res.json.user).toMatchObject({
      walletAddress: account.address.toLowerCase(),
      wallets: [{ address: account.address.toLowerCase(), chainId: 4663, isPrimary: true }],
      termsAcceptedAt: null,
      firstName: null,
    });
    expect(res.headers.get("set-cookie")).toContain(`dtf_session=${res.json.token}`);

    const viaBearer = await call("/auth/me", { key: pk, token: res.json.token });
    const viaCookie = await call("/auth/me", { key: pk, cookie: `other=1; dtf_session=${res.json.token}` });
    expect(viaBearer.json.user.id).toBe(res.json.user.id);
    expect(viaCookie.json.user.id).toBe(res.json.user.id);
  });

  it("same wallet signs in to the same user", async () => {
    const a = await signIn();
    const b = await signIn(a.account);
    expect(b.res.json.user.id).toBe(a.res.json.user.id);
  });

  it("rejects replaying a used message + signature", async () => {
    const { message, signature } = await signIn();
    const replay = await call("/auth/siwe/verify", { key: pk, body: { message, signature } });
    expect(replay.status).toBe(401);
  });

  it("rejects a signature from a different wallet", async () => {
    const victim = privateKeyToAccount(generatePrivateKey());
    const attacker = privateKeyToAccount(generatePrivateKey());
    const nonce = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: victim.address } });
    const signature = await attacker.signMessage({ message: nonce.json.message });
    expect((await call("/auth/siwe/verify", { key: pk, body: { message: nonce.json.message, signature } })).status).toBe(401);
  });

  it("rejects a message edited to another domain", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: account.address } });
    const message = (nonce.json.message as string).replace("app.test.zenoindex", "evil.example");
    const signature = await account.signMessage({ message });
    expect((await call("/auth/siwe/verify", { key: pk, body: { message, signature } })).status).toBe(401);
  });

  it("rejects an expired nonce", async () => {
    const account = privateKeyToAccount(generatePrivateKey());
    const nonce = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: account.address } });
    await db.query("update siwe_nonces set expires_at = now() - interval '1 second'");
    const signature = await account.signMessage({ message: nonce.json.message });
    expect((await call("/auth/siwe/verify", { key: pk, body: { message: nonce.json.message, signature } })).status).toBe(401);
  });

  it("rejects the wrong chain", async () => {
    const r = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: privateKeyToAccount(generatePrivateKey()).address, chainId: 1 } });
    expect(r.status).toBe(400);
    expect(r.json.error.code).toBe("wrong_chain");
  });
});

describe("tenancy", () => {
  it("a session from one project is not valid with another project's key", async () => {
    const { res } = await signIn();
    const other = await seedProject(db, "Other App");
    expect((await call("/auth/me", { key: other.pk, token: res.json.token })).json.user).toBeNull();
  });
});

describe("onboarding", () => {
  it("terms → profile → logout", async () => {
    const { res } = await signIn();
    const token = res.json.token;

    expect((await call("/auth/accept-terms", { key: pk, body: { terms: true, privacy: true } })).status).toBe(401);
    const terms = await call("/auth/accept-terms", { key: pk, token, body: { terms: true, privacy: true } });
    expect(terms.json.user.termsAcceptedAt).toBeTruthy();
    expect(terms.json.user.privacyAcceptedAt).toBeTruthy();

    const bad = await call("/auth/profile", { key: pk, token, body: { firstName: "A", lastName: "B", country: "India" } });
    expect(bad.status).toBe(400);
    expect(bad.json.error.message).toContain("country");

    const profile = await call("/auth/profile", { key: pk, token, body: { firstName: " Ada ", lastName: "Lovelace", country: "in" } });
    expect(profile.json.user).toMatchObject({ firstName: "Ada", lastName: "Lovelace", country: "IN", displayName: "Ada Lovelace" });

    const out = await call("/auth/logout", { key: pk, token, body: {} });
    expect(out.headers.get("set-cookie")).toContain("dtf_session=;");
    expect((await call("/auth/me", { key: pk, token })).json.user).toBeNull();
  });
});
