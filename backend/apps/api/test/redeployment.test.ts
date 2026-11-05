import { MAINNET } from "@zenoindex/sdk";
import { expect, it } from "vitest";
import { migrate } from "../src/db";
import { createApiKey, createProject, resolveApiKey } from "../src/tenancy";
import { createSession, upsertUserByWallet, userForSession } from "../src/users";
import { seedProject, testDb } from "./helpers";

it("upgrades only the old mainnet factory, preserving API keys, sessions and historical operations", async () => {
  const db = await testDb();
  try {
    // Model an existing database immediately before the redeployment migrations (0009 then 0010).
    await db.query("delete from schema_migrations where name in ('0009_mainnet_redeployment.sql', '0010_chainlink_factory.sql')");
    const { projectId, pk } = await seedProject(db);
    const old = "0xd00abbc1d1555a173c5081b2204579b057b05378";
    await db.query("update projects set factory_address = $1 where id = $2", [old, projectId]);
    const user = await upsertUserByWallet(db, projectId, "0x1111111111111111111111111111111111111111");
    const token = await createSession(db, user);
    await db.query(
      `insert into operations (project_id, user_id, wallet_address, action, vault_address, chain_id, tx_to, tx_data, status)
       values ($1, $2, $3, 'manager_create', $4, 4663, $4, '0x1234', 'confirmed')`,
      [projectId, user.id, user.wallet_address, old],
    );
    const org = (await db.query<{ organization_id: string }>("select organization_id from projects where id = $1", [projectId])).rows[0]!;
    const otherKeys: string[] = [];
    for (const [chainId, factory] of [[46630, old], [4663, user.wallet_address]] as const) {
      const id = await createProject(db, { organizationId: org.organization_id, name: `custom ${chainId}`,
        chainId, factory, siweDomain: "custom.example", siweUri: "https://custom.example" });
      otherKeys.push(await createApiKey(db, id, "publishable"));
    }
    await migrate(db);
    await migrate(db); // restart is idempotent
    expect((await resolveApiKey(db, pk))?.project).toMatchObject({ id: projectId, factory: MAINNET.factory, chainId: 4663 });
    expect((await userForSession(db, projectId, token))?.id).toBe(user.id);
    expect((await db.query("select tx_to, status from operations")).rows).toEqual([{ tx_to: old, status: "confirmed" }]);
    expect((await resolveApiKey(db, otherKeys[0]!))?.project.factory).toBe(old);
    expect((await resolveApiKey(db, otherKeys[1]!))?.project.factory).toBe(user.wallet_address);
  } finally {
    await db.close();
  }
});
