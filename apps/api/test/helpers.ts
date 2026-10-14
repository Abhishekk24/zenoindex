import { PGlite } from "@electric-sql/pglite";
import { MAINNET, robinhood } from "@zenoindex/sdk";
import { createPublicClient, custom, http, type PublicClient } from "viem";
import { createApp } from "../src/app";
import type { Deps } from "../src/context";
import { migrate, type Db } from "../src/db";
import { createApiKey, createOrganization, createProject } from "../src/tenancy";

export async function testDb(): Promise<Db> {
  const pg = new PGlite();
  const db: Db = {
    query: async (text, params) => ({ rows: (await pg.query(text, params as unknown[])).rows as never[] }),
    exec: (sql) => pg.exec(sql),
    close: () => pg.close(),
  };
  await migrate(db);
  return db;
}

export type RpcHandler = (method: string, params: unknown[]) => unknown;

/** A viem client whose JSON-RPC calls are answered by `handler` (offline tests), or the real mainnet RPC. */
export const fakeClient = (handler: RpcHandler) =>
  createPublicClient({
    chain: robinhood,
    transport: custom({ request: async ({ method, params }) => handler(method, (params ?? []) as unknown[]) }),
  });
export const mainnetClient = () => createPublicClient({ chain: robinhood, transport: http(process.env.RPC_URL) });

export async function seedProject(db: Db, name = "Test App") {
  const org = await createOrganization(db, `${name} org`);
  const projectId = await createProject(db, {
    organizationId: org,
    name,
    chainId: MAINNET.chainId,
    factory: MAINNET.factory,
    siweDomain: "app.test.zenoindex",
    siweUri: "https://app.test.zenoindex",
  });
  return { projectId, pk: await createApiKey(db, projectId, "publishable"), sk: await createApiKey(db, projectId, "secret") };
}

export function makeApp(db: Db, client: PublicClient, extra: Partial<Deps> = {}) {
  const app = createApp({ db, client, secureCookies: false, ...extra });
  const call = async (path: string, init: { method?: string; key?: string; token?: string; cookie?: string; body?: unknown } = {}) => {
    const headers: Record<string, string> = {};
    if (init.key) headers["x-api-key"] = init.key;
    if (init.token) headers.authorization = `Bearer ${init.token}`;
    if (init.cookie) headers.cookie = init.cookie;
    if (init.body !== undefined) headers["content-type"] = "application/json";
    const res = await app.request(`/api/v1${path}`, {
      method: init.method ?? (init.body !== undefined ? "POST" : "GET"),
      headers,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
    return { status: res.status, headers: res.headers, json: (await res.json()) as any };
  };
  return { app, call };
}
