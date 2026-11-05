// Builds the API as Vercel Build Output (v3) at backend/.vercel/output: one Node function that serves
// every path, the SQL migrations beside it, and a daily cron for NAV snapshots. Bundling with esbuild
// resolves the workspace SDK (TypeScript source) into plain JS, so Vercel needs no TS or workspace setup.
import { build } from "esbuild";
import { cpSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const api = join(dirname(fileURLToPath(import.meta.url)), "..");
const out = join(api, "../../.vercel/output");
const fn = join(out, "functions/api.func");

rmSync(out, { recursive: true, force: true });
mkdirSync(fn, { recursive: true });

await build({
  entryPoints: [join(api, "src/vercel.ts")],
  outfile: join(fn, "index.mjs"),
  bundle: true,
  platform: "node",
  format: "esm",
  target: "node22",
  // PGlite is only for local `pglite:` URLs; pg-native is an optional pg add-on.
  external: ["@electric-sql/pglite", "pg-native"],
  // Bundled CommonJS deps (pg) call require() on Node built-ins.
  banner: { js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);" },
  logLevel: "info",
});

// db/index.ts reads migrations from ./migrations next to the running module.
cpSync(join(api, "src/db/migrations"), join(fn, "migrations"), { recursive: true });
writeFileSync(join(fn, "package.json"), JSON.stringify({ type: "module" }));
writeFileSync(
  join(fn, ".vc-config.json"),
  JSON.stringify({ runtime: "nodejs22.x", handler: "index.mjs", launcherType: "Nodejs", shouldAddHelpers: false, maxDuration: 60 }, null, 2),
);
writeFileSync(
  join(out, "config.json"),
  JSON.stringify(
    {
      version: 3,
      routes: [{ handle: "filesystem" }, { src: "/(.*)", dest: "/api" }],
      crons: [{ path: "/cron/nav", schedule: "0 3 * * *" }],
    },
    null,
    2,
  ),
);
console.log(`vercel output: ${out}`);
