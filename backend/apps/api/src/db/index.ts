import { createHash } from "node:crypto";
import { mkdirSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

/** The two calls the app needs; satisfied by node-postgres in prod and PGlite in tests. */
export type Db = {
  query<T = Record<string, unknown>>(text: string, params?: unknown[]): Promise<{ rows: T[] }>;
  /** Multi-statement SQL, no params (migrations). */
  exec(sql: string): Promise<unknown>;
  close(): Promise<void>;
};

/**
 * node-postgres config. With `caCert` (PEM) the server certificate is verified against that CA —
 * for managed DBs with a private CA (e.g. Vultr) whose cert must come from env, not a file.
 * The URL's own ssl* params are dropped then, because they would override `ssl`.
 */
export function pgConfig(url: string, caCert?: string): pg.PoolConfig {
  if (!caCert) return { connectionString: url };
  const u = new URL(url);
  for (const k of [...u.searchParams.keys()]) if (k.startsWith("ssl") || k === "uselibpqcompat") u.searchParams.delete(k);
  return { connectionString: u.toString(), ssl: { ca: caCert.replace(/\\n/g, "\n"), rejectUnauthorized: true } };
}

export async function createDb(url: string, caCert?: string): Promise<Db> {
  // shortcut: `pglite:<dir>` runs an embedded file-backed Postgres for local runs without a server; use a real DATABASE_URL in production.
  if (url.startsWith("pglite:")) {
    const { PGlite } = await import("@electric-sql/pglite");
    const dir = url.slice("pglite:".length);
    mkdirSync(dir, { recursive: true });
    const pg = new PGlite(dir);
    return {
      query: async (text, params) => ({ rows: (await pg.query(text, params)).rows as never[] }),
      exec: (sql) => pg.exec(sql),
      close: () => pg.close(),
    };
  }
  const pool = new pg.Pool({ ...pgConfig(url, caCert), max: 10, statement_timeout: 15_000 });
  return {
    query: async (text, params) => ({ rows: (await pool.query(text, params)).rows }),
    exec: (sql) => pool.query(sql),
    close: () => pool.end(),
  };
}

const migrationsDir = join(dirname(fileURLToPath(import.meta.url)), "migrations");

/** Applies migrations/*.sql in order, once each; refuses to boot if an applied file was edited. */
export async function migrate(db: Db) {
  await db.exec(
    "create table if not exists schema_migrations (name text primary key, checksum text not null, applied_at timestamptz not null default now())",
  );
  for (const name of readdirSync(migrationsDir).filter((f) => f.endsWith(".sql")).sort()) {
    const sql = readFileSync(join(migrationsDir, name), "utf8");
    const checksum = createHash("sha256").update(sql).digest("hex");
    const { rows } = await db.query<{ checksum: string }>("select checksum from schema_migrations where name = $1", [name]);
    if (rows[0]) {
      if (rows[0].checksum !== checksum) throw new Error(`migration ${name} was modified after being applied`);
      continue;
    }
    // One string = one connection + one transaction; the xact lock serializes concurrent deploys.
    await db.exec(
      `begin; select pg_advisory_xact_lock(727001); ${sql}\n; insert into schema_migrations (name, checksum) values ('${name}', '${checksum}'); commit;`,
    );
  }
}
