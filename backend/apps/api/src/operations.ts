import type { TxRequest } from "@zenoindex/sdk";
import type { Address } from "viem";
import { findVault, snapshot, type Snapshot, type VaultState } from "./chain";
import { requireUser, type Ctx, type Deps } from "./context";
import type { Db } from "./db";
import type { UserRow } from "./users";

// Shared by the trade and manager routes: every prepared transaction is an `operations` row,
// settled through /operations/:id/submit|confirm|fail.

export type Action =
  | "buy"
  | "redeem_request"
  | "redeem_swap"
  | "redeem_claim"
  | "redeem_claim_in_kind"
  | "manager_genesis"
  | "manager_deploy"
  | "manager_rebalance"
  | "manager_allocations"
  | "manager_pause"
  | "manager_write_off"
  | "manager_reactivate"
  | "manager_fee_claim"
  | "manager_create";
export type OperationRow = {
  id: string;
  user_id: string;
  wallet_address: string;
  action: Action;
  vault_address: string;
  chain_id: number;
  tx_to: string;
  tx_data: string;
  amount_raw: string | null;
  shares_raw: string | null;
  tx_hash: string | null;
  status: "draft_prepared" | "submitted" | "confirmed" | "failed";
  failure_reason: string | null;
  created_at: Date;
  updated_at: Date;
  submitted_at: Date | null;
  confirmed_at: Date | null;
};

const iso = (d: Date | null) => (d ? new Date(d).toISOString() : null);

/** Flat Operation object (the app reads it at the top level). */
export const publicOperation = (o: OperationRow) => ({
  id: o.id,
  action: o.action,
  status: o.status,
  txHash: o.tx_hash,
  resourceId: o.vault_address,
  walletAddress: o.wallet_address,
  failureReason: o.failure_reason,
  createdAt: iso(o.created_at),
  updatedAt: iso(o.updated_at),
  submittedAt: iso(o.submitted_at),
  confirmedAt: iso(o.confirmed_at),
});

export async function tradeContext(c: Ctx, client: Deps["client"]) {
  const user = requireUser(c);
  const project = c.get("project");
  const snap: Snapshot = await snapshot(client, project.factory);
  return { user, project, snap, vault: findVault(snap, c.req.param("id")!) };
}

export function draft(op: OperationRow, tx: TxRequest, chainId: number, data?: Record<string, string>) {
  return {
    action: op.action,
    requestId: op.id,
    operation: publicOperation(op),
    transaction: { to: tx.to, data: tx.data, value: tx.value.toString(), chainId },
    ...(data && { data }),
  };
}

export async function insertOperation(
  db: Db,
  project: { id: string; chainId: number },
  user: UserRow,
  /** The contract the transaction targets: a vault, or the FeeEscrow for fee claims. */
  vault: { address: string },
  action: Action,
  tx: TxRequest,
  amounts: { amount?: bigint; shares?: bigint },
) {
  const { rows } = await db.query<OperationRow>(
    `insert into operations (project_id, user_id, wallet_address, action, vault_address, chain_id, tx_to, tx_data, tx_value, amount_raw, shares_raw)
     values ($1, $2, $3, $4, $5, $11, $6, $7, $8, $9, $10) returning *`,
    [
      project.id,
      user.id,
      user.wallet_address,
      action,
      vault.address.toLowerCase(),
      tx.to.toLowerCase(),
      tx.data.toLowerCase(),
      tx.value.toString(),
      amounts.amount?.toString() ?? null,
      amounts.shares?.toString() ?? null,
      project.chainId,
    ],
  );
  return rows[0]!;
}

/** Asset → USDG route override from `pnpm cli set-swap-path`; callers default to the direct pool. */
export async function swapPath(db: Db, chainId: number, asset: string) {
  const { rows } = await db.query<{ path: string[] }>("select path from swap_paths where chain_id = $1 and asset_address = $2", [
    chainId,
    asset.toLowerCase(),
  ]);
  return rows[0]?.path as Address[] | undefined;
}
