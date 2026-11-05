// Everything the API needs before it can answer: env, database + migrations, the seeded project, a chain
// client checked against the configured network, and the Hono app. Shared by the long-running server
// (index.ts) and the serverless entry (vercel.ts).
import { MAINNET, activeChain } from "@zenoindex/sdk";
import { createPublicClient, http } from "viem";
import { createApp } from "./app";
import { publicRpcUrl } from "./chain";
import { createDb, migrate } from "./db";
import { loadEnv, type Env } from "./env";
import { robinhoodLogos } from "./logos";
import { privyAuth } from "./privy";
import { seedProject, type KeyType } from "./tenancy";

export async function boot(env: Env = loadEnv()) {
  const db = await createDb(env.DATABASE_URL, env.DATABASE_CA_CERT);
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

  const client = createPublicClient({ chain: activeChain, transport: http(env.RPC_URL) });
  if ((await client.getChainId()) !== activeChain.id) throw new Error(`RPC_URL is not ${activeChain.name} (${activeChain.id})`);

  const didit =
    env.DIDIT_API_KEY && env.DIDIT_WORKFLOW_ID
      ? { apiKey: env.DIDIT_API_KEY, workflowId: env.DIDIT_WORKFLOW_ID, webhookSecret: env.DIDIT_WEBHOOK_SECRET, callbackUrl: env.DIDIT_CALLBACK_URL }
      : undefined;
  const privy = env.PRIVY_APP_ID && env.PRIVY_APP_SECRET ? privyAuth(env.PRIVY_APP_ID, env.PRIVY_APP_SECRET) : undefined;
  const app = createApp({ db, client, secureCookies: env.NODE_ENV === "production", didit, privy, logos: activeChain.id === 4663 ? robinhoodLogos() : undefined, demoStats: env.DEMO_STATS,
    // Robinhood's public RPC serves eth_getLogs over the whole chain in one call; keyed providers often cap the range.
    logsClient: createPublicClient({ chain: activeChain, transport: http(publicRpcUrl) }),
  });
  return { env, db, client, app };
}
