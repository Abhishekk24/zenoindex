import { serve } from "@hono/node-server";
import { boot } from "./boot";
import { startNavWorker } from "./stats";

const { env, db, client, app } = await boot();
startNavWorker(db, client);
serve({ fetch: app.fetch, port: env.PORT }, (info) => console.log(`zenoindex api listening on :${info.port}`));
