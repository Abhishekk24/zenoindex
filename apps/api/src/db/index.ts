import { createHash } from "node:crypto";
import { readdirSync, readFileSync } from "node:fs";
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

export function createDb(url: string): Db {
  const pool = new pg.Pool({ connectionString: url, max: 10, statement_timeout: 15_000 });
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
