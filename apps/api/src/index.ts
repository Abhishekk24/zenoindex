import { serve } from "@hono/node-server";
import { robinhood } from "@zenoindex/sdk";
import { createPublicClient, http } from "viem";
import { createApp } from "./app";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";

const env = loadEnv();
const db = createDb(env.DATABASE_URL);
await migrate(db);

const client = createPublicClient({ chain: robinhood, transport: http(env.RPC_URL) });
if ((await client.getChainId()) !== robinhood.id) throw new Error(`RPC_URL is not Robinhood mainnet (${robinhood.id})`);

const app = createApp({ db, client, secureCookies: env.NODE_ENV === "production" });
serve({ fetch: app.fetch, port: env.PORT }, (info) => console.log(`zenoindex api listening on :${info.port}`));
