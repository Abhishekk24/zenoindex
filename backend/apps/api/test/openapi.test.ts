import { expect, it } from "vitest";
import { createApp } from "../src/app";
import { openapi } from "../src/openapi";
import { fakeClient, testDb } from "./helpers";

it("every route is documented, and every documented route exists", async () => {
  const app = createApp({ db: await testDb(), client: fakeClient(() => null), secureCookies: false });
  const SELF = new Set(["/openapi.json", "/docs"]);
  const actual = new Set(
    app.routes
      .filter((r) => r.method !== "ALL" && !SELF.has(r.path))
      .map((r) => `${r.method.toLowerCase()} ${r.path.replace(/:(\w+)/g, "{$1}")}`),
  );
  const documented = new Set(
    Object.entries(openapi.paths).flatMap(([path, ops]) => Object.keys(ops).map((m) => `${m} ${path}`)),
  );
  expect([...actual].filter((r) => !documented.has(r)), "routes missing from openapi.ts").toEqual([]);
  expect([...documented].filter((r) => !actual.has(r)), "documented routes that don't exist").toEqual([]);
});

it("serves the spec and the docs page without an API key", async () => {
  const app = createApp({ db: await testDb(), client: fakeClient(() => null), secureCookies: false });
  const spec = await app.request("/openapi.json");
  expect(spec.status).toBe(200);
  expect((await spec.json()).openapi).toBe("3.1.0");
  const docs = await app.request("/docs");
  expect(docs.status).toBe(200);
  expect(await docs.text()).toContain('integrity="sha384-');
});
