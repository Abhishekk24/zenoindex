import { Hono, type ErrorHandler } from "hono";
import { cors } from "hono/cors";
import type { AppEnv, Deps } from "./context";
import { ApiError, unauthorized } from "./errors";
import { openapi, swaggerHtml } from "./openapi";
import { authRoutes } from "./routes/auth";
import { dtfRoutes } from "./routes/dtfs";
import { diditWebhook, kycRoutes } from "./routes/kyc";
import { portfolioRoutes } from "./routes/portfolio";
import { tradeRoutes } from "./routes/trade";
import { resolveApiKey } from "./tenancy";
import { sessionToken, userForSession } from "./users";

const onError: ErrorHandler<AppEnv> = (err, c) => {
  if (err instanceof ApiError) {
    return c.json({ error: { status: err.status, code: err.code, message: err.message, retryable: err.retryable } }, err.status);
  }
  console.error(err);
  return c.json({ error: { status: 500, code: "internal", message: "Something went wrong. Please try again.", retryable: true } }, 500);
};

export function createApp(deps: Deps) {
  const { db } = deps;
  const app = new Hono<AppEnv>();
  app.onError(onError);
  app.notFound((c) => c.json({ error: { status: 404, code: "not_found", message: "Route not found.", retryable: false } }, 404));
  app.get("/health", (c) => c.json({ ok: true }));
  // Public API docs (no key): the spec documents routes only, never data.
  app.get("/openapi.json", (c) => c.json(openapi));
  app.get("/docs", (c) => c.html(swaggerHtml));
  diditWebhook(app, deps);

  const v1 = new Hono<AppEnv>();
  v1.onError(onError);

  // Browser clients (Expo web): answer preflights before the API-key check. No cookies cross-origin — sessions travel as Bearer tokens.
  v1.use("*", cors({ origin: "*", allowHeaders: ["x-api-key", "authorization", "content-type", "idempotency-key", "x-dtf-chain-id"] }));

  // Every request is made on behalf of a project, identified by its API key.
  v1.use("*", async (c, next) => {
    const key = c.req.header("x-api-key");
    const resolved = key ? await resolveApiKey(db, key) : null;
    if (!resolved) throw unauthorized("Missing or invalid API key.");
    c.set("project", resolved.project);
    c.set("keyType", resolved.type);
    // shortcut: last_used_at written at most once a minute per key, no usage metering yet (Phase 2 billing).
    void db
      .query("update api_keys set last_used_at = now() where id = $1 and (last_used_at is null or last_used_at < now() - interval '1 minute')", [resolved.keyId])
      .catch(() => {});
    await next();
  });

  // Optional end-user session; routes that need one call requireUser().
  v1.use("*", async (c, next) => {
    const token = sessionToken(c.req.header("authorization"), c.req.header("cookie"));
    c.set("sessionToken", token);
    c.set("user", token ? await userForSession(db, c.get("project").id, token) : null);
    await next();
  });

  // shortcut: no per-key rate limiting or idempotency-key replay yet (Phase 1).
  authRoutes(v1, deps);
  dtfRoutes(v1, deps);
  tradeRoutes(v1, deps);
  portfolioRoutes(v1, deps);
  kycRoutes(v1, deps);

  app.route("/api/v1", v1);
  return app;
}
