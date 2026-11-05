// Vercel serverless entry. One instance boots once (migrations, seed, chain check) and then serves
// requests; the long-running NAV worker becomes a daily Vercel Cron call to /cron/nav.
import type { IncomingMessage, ServerResponse } from "node:http";
import { handle } from "@hono/node-server/vercel";
import { boot } from "./boot";
import { snapshotNav } from "./stats";

let ready: ReturnType<typeof start> | undefined;

async function start() {
  const { db, client, app } = await boot();
  // Vercel Cron sends `Authorization: Bearer $CRON_SECRET`; nothing else may trigger snapshots.
  app.get("/cron/nav", async (c) => {
    const secret = process.env.CRON_SECRET;
    if (!secret || c.req.header("authorization") !== `Bearer ${secret}`) {
      return c.json({ error: { status: 401, code: "unauthorized", message: "Not allowed.", retryable: false } }, 401);
    }
    return c.json(await snapshotNav(db, client));
  });
  return handle(app);
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  ready ??= start().catch((e: unknown) => {
    ready = undefined; // let the next request retry a failed boot
    throw e;
  });
  return (await ready)(req, res);
}
