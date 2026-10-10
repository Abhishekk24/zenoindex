import { createHash, randomBytes } from "node:crypto";
import type { Address } from "viem";
import type { Db } from "./db";

export type KeyType = "publishable" | "secret";
export type Project = {
  id: string;
  name: string;
  chainId: number;
  factory: Address;
  siweDomain: string;
  siweUri: string;
};

export const sha256 = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createOrganization(db: Db, name: string) {
  const { rows } = await db.query<{ id: string }>("insert into organizations (name) values ($1) returning id", [name]);
  return rows[0]!.id;
}

export async function createProject(
  db: Db,
  p: { organizationId: string; name: string; chainId: number; factory: string; siweDomain: string; siweUri: string },
) {
  const { rows } = await db.query<{ id: string }>(
    `insert into projects (organization_id, name, chain_id, factory_address, siwe_domain, siwe_uri)
     values ($1, $2, $3, $4, $5, $6) returning id`,
    [p.organizationId, p.name, p.chainId, p.factory.toLowerCase(), p.siweDomain, p.siweUri],
  );
  return rows[0]!.id;
}

/** Returns the raw key exactly once; only its SHA-256 is stored. */
export async function createApiKey(db: Db, projectId: string, type: KeyType, name?: string) {
  const key = `${type === "publishable" ? "pk" : "sk"}_live_${randomBytes(24).toString("base64url")}`;
  await db.query("insert into api_keys (project_id, type, prefix, key_hash, name) values ($1, $2, $3, $4, $5)", [
    projectId,
    type,
    key.slice(0, 16),
    sha256(key),
    name ?? null,
  ]);
  return key;
}

export async function resolveApiKey(db: Db, key: string): Promise<{ keyId: string; type: KeyType; project: Project } | null> {
  const { rows } = await db.query<{
    key_id: string;
    type: KeyType;
    id: string;
    name: string;
    chain_id: number;
    factory_address: Address;
    siwe_domain: string;
    siwe_uri: string;
  }>(
    `select k.id as key_id, k.type, p.id, p.name, p.chain_id, p.factory_address, p.siwe_domain, p.siwe_uri
     from api_keys k join projects p on p.id = k.project_id
     where k.key_hash = $1 and k.revoked_at is null`,
    [sha256(key)],
  );
  const r = rows[0];
  if (!r) return null;
  return {
    keyId: r.key_id,
    type: r.type,
    project: { id: r.id, name: r.name, chainId: r.chain_id, factory: r.factory_address, siweDomain: r.siwe_domain, siweUri: r.siwe_uri },
  };
}
