// Operator CLI (no admin UI in v1). Usage:
//   pnpm cli create-org --name "Cyrene"
//   pnpm cli create-project --org <orgId> --name "ZenoIndex Mobile" --domain app.zenoindex.xyz --uri https://app.zenoindex.xyz
//   pnpm cli create-key --project <projectId> --type publishable|secret [--name mobile]
//   pnpm cli set-swap-path --asset 0x… --path 0xasset,0xhop,…,0xusdg
import { MAINNET } from "@zenoindex/sdk";
import { parseArgs } from "node:util";
import { createDb, migrate } from "./db";
import { loadEnv } from "./env";
import { createApiKey, createOrganization, createProject, type KeyType } from "./tenancy";

const [command, ...rest] = process.argv.slice(2);
const { values: a } = parseArgs({
  args: rest,
  options: {
    name: { type: "string" },
    org: { type: "string" },
    project: { type: "string" },
    type: { type: "string" },
    domain: { type: "string" },
    uri: { type: "string" },
    asset: { type: "string" },
    path: { type: "string" },
  },
});
const need = (k: keyof typeof a) => a[k] ?? fail(`--${k} is required`);
function fail(msg: string): never {
  console.error(msg);
  process.exit(1);
}
const isAddr = (s: string) => /^0x[0-9a-fA-F]{40}$/.test(s);

const db = createDb(loadEnv().DATABASE_URL);
await migrate(db);
try {
  switch (command) {
    case "create-org":
      console.log(await createOrganization(db, need("name")));
      break;
    case "create-project":
      console.log(
        await createProject(db, {
          organizationId: need("org"),
          name: need("name"),
          chainId: MAINNET.chainId,
          factory: MAINNET.factory,
          siweDomain: need("domain"),
          siweUri: need("uri"),
        }),
      );
      break;
    case "create-key": {
      const type = need("type");
      if (type !== "publishable" && type !== "secret") fail("--type must be publishable or secret");
      console.log(await createApiKey(db, need("project"), type as KeyType, a.name));
      console.error("Store this key now — it is not shown again.");
      break;
    }
    case "set-swap-path": {
      const asset = need("asset");
      const path = need("path").split(",").map((s) => s.trim().toLowerCase());
      if (!isAddr(asset) || path.length < 2 || !path.every(isAddr)) fail("--asset and --path must be 0x addresses");
      if (path[0] !== asset.toLowerCase() || path.at(-1) !== MAINNET.usdg) fail("path must start at the asset and end at USDG");
      await db.query(
        `insert into swap_paths (chain_id, asset_address, path) values ($1, $2, $3)
         on conflict (chain_id, asset_address) do update set path = excluded.path`,
        [MAINNET.chainId, asset.toLowerCase(), path],
      );
      console.log("ok");
      break;
    }
    default:
      fail(`unknown command: ${command ?? "(none)"} — see the header of src/cli.ts`);
  }
} finally {
  await db.close();
}
