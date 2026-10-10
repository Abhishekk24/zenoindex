import { MAINNET } from "@zenoindex/sdk";
import { expect, it } from "vitest";
import { seedProject, sha256 } from "../src/tenancy";
import { fakeClient, makeApp, testDb } from "./helpers";

it("env seed is idempotent and the pre-generated key works", async () => {
  const db = await testDb();
  const pk = "pk_live_pregenerated";
  const seed = {
    name: "ZenoIndex Mobile",
    chainId: MAINNET.chainId,
    factory: MAINNET.factory,
    siweDomain: "api.example.com",
    siweUri: "https://api.example.com",
    keyHashes: [{ type: "publishable" as const, hash: sha256(pk) }],
  };
  const first = await seedProject(db, seed);
  const second = await seedProject(db, seed); // every reboot runs it again
  expect(second).toBe(first);
  expect((await db.query("select * from api_keys")).rows).toHaveLength(1);

  const { call } = makeApp(db, fakeClient(() => null));
  const nonce = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: "0x1111111111111111111111111111111111111111" } });
  expect(nonce.status).toBe(200);
  expect(nonce.json.message).toMatch(/^api\.example\.com wants you to sign in/);
});
