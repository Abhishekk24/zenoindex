import {
  applySlippage,
  buildClaim,
  buildClaimInKind,
  buildDeposit,
  buildRequestRedeem,
  buildSwapAssetToUsdc,
  getRedeemProgress,
  nextRedeemStep,
  previewDeposit,
  swapFloor,
  USDG_DECIMALS,
  SHARE_DECIMALS,
  type TxRequest,
} from "@zenoindex/sdk";
import type { Hono } from "hono";
import { erc20Abi, parseUnits, TransactionNotFoundError, TransactionReceiptNotFoundError, type Address, type Hex } from "viem";
import { z } from "zod";
import { findVault, isTradable, mintOf, snapshot, type Snapshot, type VaultState } from "../chain";
import { address, amount6, parseBody, requireUser, txHash, type AppEnv, type Ctx, type Deps } from "../context";
import type { Db } from "../db";
import { ApiError, badRequest, conflict, notFound } from "../errors";
import type { UserRow } from "../users";

type Action = "buy" | "redeem_request" | "redeem_swap" | "redeem_claim" | "redeem_claim_in_kind";
type OperationRow = {
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

export function tradeRoutes(app: Hono<AppEnv>, { db, client }: Deps) {
  app.post("/dtfs/:id/buy/prepare", async (c) => {
    const { user, project, snap, vault } = await tradeContext(c, client);
    const body = await parseBody(
      c,
      z.object({ amount: amount6, recipient: address, slippageBps: z.number().int().min(0).max(5000).default(100) }),
    );
    assertSelf(user, body.recipient);
    if (!isTradable(vault, snap)) throw conflict("not_tradable", "This basket isn't open for investing right now.");

    const usdgAmount = parseUnits(body.amount, USDG_DECIMALS);
    if (usdgAmount === 0n) throw badRequest("validation_failed", "amount: must be greater than 0");
    const preview = await previewDeposit(client, vault.address, usdgAmount);
    if (preview.sharesOut === 0n) throw conflict("not_tradable", "This basket is full or not ready for investing.");

    const tx = buildDeposit(vault.address, usdgAmount, applySlippage(preview.sharesOut, body.slippageBps));
    const op = await insertOperation(db, project, user, vault, "buy", tx, { amount: usdgAmount, shares: preview.sharesOut });
    return c.json(
      draft(op, tx, project.chainId, {
        entryFee: String(preview.companyFee + preview.managerFee),
        estimatedShares: String(preview.sharesOut),
      }),
    );
  });

  // Each call returns the NEXT redeem transaction: requestRedeem → swapAssetToUsdc (per asset) → claim.
  // The app repeats prepare → sign → confirm until a response has `finalStep: true`.
  app.post("/dtfs/:id/redeem/prepare", async (c) => {
    const { user, project, snap, vault } = await tradeContext(c, client);
    const body = await parseBody(
      c,
      z.object({ shares: amount6.optional(), recipient: address, owner: address.optional(), inKind: z.boolean().default(false) }),
    );
    assertSelf(user, body.recipient);
    if (body.owner) assertSelf(user, body.owner);

    const wallet = user.wallet_address as Address;
    const step = nextRedeemStep(await getRedeemProgress(client, vault.address, wallet), { inKind: body.inKind });

    if (step.kind === "request") {
      if (!body.shares) throw badRequest("validation_failed", "shares: required to start a sale");
      const shares = parseUnits(body.shares, SHARE_DECIMALS);
      if (shares === 0n) throw badRequest("validation_failed", "shares: must be greater than 0");
      const balance = await client.readContract({ address: vault.sharesToken, abi: erc20Abi, functionName: "balanceOf", args: [wallet] });
      if (balance < shares) throw badRequest("insufficient_shares", "You don't have that many shares.");
      const tx = buildRequestRedeem(vault.address, shares);
      const op = await insertOperation(db, project, user, vault, "redeem_request", tx, { shares });
      return c.json({ ...draft(op, tx, project.chainId), step: "request", finalStep: false, stepsRemaining: null });
    }

    if (step.kind === "swap") {
      if (vault.adminLocked || snap.protocol.isEmergency) throw conflict("not_tradable", "Selling is paused for this basket right now.");
      const mint = mintOf(snap, step.leg.assetId);
      // Every listed asset has a direct pool to USDG on the adapter; swap_paths only overrides that with multi-hop routes.
      const path = mint && ((await swapPath(db, project.chainId, mint)) ?? [mint, snap.protocol.usdg]);
      if (!mint || !path) {
        throw conflict("no_swap_route", "This asset can't be swapped to USDG yet. Finish the sale in kind instead.");
      }
      const minUsdcOut = await swapFloor(client, mint, snap.protocol.usdg, step.leg.amountIn, project.factory);
      const tx = buildSwapAssetToUsdc(vault.address, step.leg.index, path, minUsdcOut);
      const op = await insertOperation(db, project, user, vault, "redeem_swap", tx, {});
      return c.json({ ...draft(op, tx, project.chainId), step: "swap", finalStep: false, stepsRemaining: step.remaining + 1 });
    }

    const inKind = step.kind === "claimInKind";
    const tx = inKind ? buildClaimInKind(vault.address) : buildClaim(vault.address);
    const op = await insertOperation(db, project, user, vault, inKind ? "redeem_claim_in_kind" : "redeem_claim", tx, {});
    return c.json({ ...draft(op, tx, project.chainId), step: step.kind, finalStep: true, stepsRemaining: 1 });
  });

  app.get("/operations/:id", async (c) => {
    return c.json(publicOperation(await loadOperation(db, c, requireUser(c))));
  });

  app.post("/operations/:id/submit", async (c) => {
    const user = requireUser(c);
    const { txHash: hash } = await parseBody(c, z.object({ txHash }));
    const op = await loadOperation(db, c, user);
    if (op.tx_hash === hash) return c.json(publicOperation(op)); // retried submit
    if (op.status !== "draft_prepared") throw conflict("invalid_transition", "This order was already submitted.");
    const updated = await transition(db, op.id, ["draft_prepared"], { status: "submitted", txHash: hash });
    return c.json(publicOperation(updated ?? (await loadOperation(db, c, user))));
  });

  // The client says it's done; the chain decides. Also used for `fail` when a tx hash is known.
  const settle = async (c: Ctx, user: UserRow, hash: Hex) => {
    const op = await loadOperation(db, c, user);
    if (op.status === "confirmed" || op.status === "failed") return op;
    if (op.tx_hash && op.tx_hash !== hash) throw conflict("tx_mismatch", "That transaction doesn't belong to this order.");
    const outcome = await checkOnChain(client, op, hash);
    if (outcome === "pending") {
      return op.status === "draft_prepared"
        ? ((await transition(db, op.id, ["draft_prepared"], { status: "submitted", txHash: hash })) ?? op)
        : op;
    }
    const next =
      outcome === "success" ? ({ status: "confirmed", txHash: hash } as const) : ({ status: "failed", txHash: hash, reason: "transaction reverted" } as const);
    return (await transition(db, op.id, ["draft_prepared", "submitted"], next)) ?? (await loadOperation(db, c, user));
  };

  app.post("/operations/:id/confirm", async (c) => {
    const user = requireUser(c);
    const { txHash: hash } = await parseBody(c, z.object({ txHash }));
    return c.json(publicOperation(await settle(c, user, hash)));
  });

  app.post("/operations/:id/fail", async (c) => {
    const user = requireUser(c);
    const body = await parseBody(c, z.object({ txHash: txHash.optional(), reason: z.string().max(500).optional() }));
    if (body.txHash) return c.json(publicOperation(await settle(c, user, body.txHash)));
    // No tx was sent (e.g. the user rejected it in the wallet).
    const op = await loadOperation(db, c, user);
    const updated = await transition(db, op.id, ["draft_prepared"], { status: "failed", reason: body.reason ?? "cancelled" });
    return c.json(publicOperation(updated ?? op));
  });
}

async function tradeContext(c: Ctx, client: Deps["client"]) {
  const user = requireUser(c);
  const project = c.get("project");
  const snap: Snapshot = await snapshot(client, project.factory);
  return { user, project, snap, vault: findVault(snap, c.req.param("id")!) };
}

/** Contracts act on msg.sender, so the signer must be the signed-in wallet. */
function assertSelf(user: UserRow, wallet: string) {
  if (wallet.toLowerCase() !== user.wallet_address) {
    throw new ApiError(403, "wallet_mismatch", "Connect the wallet you signed in with.");
  }
}

function draft(op: OperationRow, tx: TxRequest, chainId: number, data?: Record<string, string>) {
  return {
    action: op.action,
    requestId: op.id,
    operation: publicOperation(op),
    transaction: { to: tx.to, data: tx.data, value: tx.value.toString(), chainId },
    ...(data && { data }),
  };
}

async function insertOperation(
  db: Db,
  project: { id: string; chainId: number },
  user: UserRow,
  vault: VaultState,
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

async function loadOperation(db: Db, c: Ctx, user: UserRow) {
  const id = c.req.param("id")!;
  if (!/^[0-9a-f-]{36}$/i.test(id)) throw notFound("Order");
  const { rows } = await db.query<OperationRow>("select * from operations where id = $1 and user_id = $2", [id, user.id]);
  if (!rows[0]) throw notFound("Order");
  return rows[0];
}

/** Guarded state change: only applies if the row is still in one of `from` (no confirmed → submitted regressions). */
async function transition(
  db: Db,
  id: string,
  from: OperationRow["status"][],
  to: { status: "submitted" | "confirmed" | "failed"; txHash?: string; reason?: string },
) {
  try {
    const { rows } = await db.query<OperationRow>(
      `update operations set status = $2, tx_hash = coalesce($3, tx_hash), failure_reason = coalesce($4, failure_reason),
         updated_at = now(),
         submitted_at = case when $2 = 'submitted' then now() else submitted_at end,
         confirmed_at = case when $2 = 'confirmed' then now() else confirmed_at end,
         failed_at = case when $2 = 'failed' then now() else failed_at end
       where id = $1 and status = any($5::text[]) returning *`,
      [id, to.status, to.txHash ?? null, to.reason ?? null, from],
    );
    return rows[0] ?? null;
  } catch (e) {
    if ((e as { code?: string }).code === "23505") throw conflict("tx_mismatch", "That transaction is already used by another order.");
    throw e;
  }
}

/** Verifies the mined tx is exactly the one we prepared, sent by the user. */
async function checkOnChain(client: Deps["client"], op: OperationRow, hash: Hex): Promise<"pending" | "success" | "reverted"> {
  let tx, receipt;
  try {
    [tx, receipt] = await Promise.all([client.getTransaction({ hash }), client.getTransactionReceipt({ hash })]);
  } catch (e) {
    if (e instanceof TransactionNotFoundError || e instanceof TransactionReceiptNotFoundError) return "pending";
    throw e;
  }
  const matches =
    tx.from.toLowerCase() === op.wallet_address &&
    tx.to?.toLowerCase() === op.tx_to &&
    tx.input.toLowerCase() === op.tx_data;
  if (!matches) throw conflict("tx_mismatch", "That transaction doesn't match this order.");
  return receipt.status === "success" ? "success" : "reverted";
}

async function swapPath(db: Db, chainId: number, asset: string) {
  const { rows } = await db.query<{ path: string[] }>("select path from swap_paths where chain_id = $1 and asset_address = $2", [
    chainId,
    asset.toLowerCase(),
  ]);
  return rows[0]?.path as Address[] | undefined;
}
