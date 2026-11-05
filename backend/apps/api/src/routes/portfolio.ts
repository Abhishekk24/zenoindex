import { SHARE_DECIMALS, USDG_DECIMALS } from "@zenoindex/sdk";
import type { Hono } from "hono";
import { erc20Abi, formatUnits, type Address } from "viem";
import { findVault, snapshot } from "../chain";
import { requireUser, type AppEnv, type Deps } from "../context";
import { ApiError } from "../errors";

export function portfolioRoutes(app: Hono<AppEnv>, { db, client }: Deps) {
  app.get("/wallets/:wallet/portfolio", async (c) => {
    const user = requireUser(c);
    const wallet = c.req.param("wallet").toLowerCase();
    if (wallet !== user.wallet_address) throw new ApiError(403, "forbidden", "You can only view your own portfolio.");

    const snap = await snapshot(client, c.get("project").factory);
    const balances = await client.multicall({
      allowFailure: false,
      contracts: snap.vaults.map(
        (v) => ({ address: v.sharesToken, abi: erc20Abi, functionName: "balanceOf", args: [wallet as Address] }) as const,
      ),
    });
    const asOf = new Date().toISOString();
    const positions = snap.vaults.flatMap((v, i) => {
      const shares = balances[i]!;
      if (shares === 0n) return [];
      const value = v.sharePrice === null ? 0n : (shares * v.sharePrice) / 10n ** BigInt(SHARE_DECIMALS);
      return [{ dtfId: v.address.toLowerCase(), shares: shares.toString(), value: formatUnits(value, USDG_DECIMALS), asOf }];
    });
    return c.json({ wallet, positions });
  });

  // shortcut: the signed-in user's own orders placed through this API; replace with indexed on-chain history (Phase 3).
  app.get("/dtfs/:id/transactions", async (c) => {
    const user = requireUser(c);
    const project = c.get("project");
    const vault = findVault(await snapshot(client, project.factory), c.req.param("id"));
    const { rows } = await db.query<{
      id: string;
      tx_hash: string;
      action: string;
      wallet_address: string;
      amount_raw: string | null;
      shares_raw: string | null;
      status: string;
      created_at: Date;
    }>(
      `select id, tx_hash, action, wallet_address, amount_raw, shares_raw, status, created_at from operations
       where project_id = $1 and user_id = $2 and vault_address = $3 and tx_hash is not null
       order by created_at desc limit 50`,
      [project.id, user.id, vault.address.toLowerCase()],
    );
    return c.json({
      items: rows.map((r) => ({
        id: r.id,
        txHash: r.tx_hash,
        chainId: project.chainId,
        action: r.action === "buy" ? "invest" : "redeem",
        walletAddress: r.wallet_address,
        assetId: vault.address.toLowerCase(),
        ...(r.amount_raw && { amountRaw: r.amount_raw }),
        ...(r.shares_raw && { shareAmountRaw: r.shares_raw }),
        status: r.status === "confirmed" ? "confirmed" : r.status === "failed" ? "reverted" : "pending",
        occurredAt: new Date(r.created_at).toISOString(),
      })),
    });
  });
}
