import { serve } from "@hono/node-server";
import { MAINNET, robinhood } from "@zenoindex/sdk";
import { createPublicClient, http } from "viem";
import { createApp } from "./app";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";
import { seedProject, type KeyType } from "./tenancy";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
await migrate(db);

if (env.SEED_PROJECT_NAME) {
  if (!env.PUBLIC_URL) throw new Error("PUBLIC_URL is required with SEED_PROJECT_NAME (it becomes the sign-in domain)");
  const keyHashes = [
    ...(env.SEED_PUBLISHABLE_KEY_SHA256 ? [{ type: "publishable" as KeyType, hash: env.SEED_PUBLISHABLE_KEY_SHA256 }] : []),
    ...(env.SEED_SECRET_KEY_SHA256 ? [{ type: "secret" as KeyType, hash: env.SEED_SECRET_KEY_SHA256 }] : []),
  ];
  await seedProject(db, {
    name: env.SEED_PROJECT_NAME,
    chainId: MAINNET.chainId,
    factory: MAINNET.factory,
    siweDomain: new URL(env.PUBLIC_URL).host,
    siweUri: env.PUBLIC_URL,
    keyHashes,
  });
}

const client = createPublicClient({ chain: robinhood, transport: http(env.RPC_URL) });
if ((await client.getChainId()) !== robinhood.id) throw new Error(`RPC_URL is not Robinhood mainnet (${robinhood.id})`);

const app = createApp({ db, client, secureCookies: env.NODE_ENV === "production" });
serve({ fetch: app.fetch, port: env.PORT }, (info) => console.log(`zenoindex api listening on :${info.port}`));
