import {
  applySlippage,
  BASELINE_PRICE_DECIMALS,
  BPS,
  buildExecuteRebalance,
  buildGenesisDeposit,
  buildProposeReactivate,
  buildProposeWriteOff,
  buildClaimManagerFees,
  buildCreateVault,
  canCreateVault,
  buildSetPaused,
  buildSetTargetAllocations,
  buildSwapUsdcToAsset,
  GENESIS_SEED_USDC,
  hasPrices,
  MAX_DEPOSIT_FEE_BPS,
  MAX_REDEEM_FEE_BPS,
  MIN_REDEEM_FEE_BPS,
  SHARE_DECIMALS,
  getFeeEscrow,
  getManagerClaimable,
  getTradingFeeBps,
  getManagerView,
  isVaultOperator,
  MAX_ASSETS,
  REBALANCE_DRIFT_BPS,
  swapFloor,
  USDG_DECIMALS,
  VaultAbi,
  type ManagerView,
  type TxRequest,
} from "@zenoindex/sdk";
import type { Hono } from "hono";
import { formatUnits, parseUnits, zeroAddress, type Address } from "viem";
import { z } from "zod";
import { mintOf, snapshot, toDtfRow, type Snapshot, type VaultState } from "../chain";
import { address, amount6, parseBody, requireUser, type AppEnv, type Ctx, type Deps } from "../context";
import { ApiError, badRequest, conflict } from "../errors";
import { draft, insertOperation, swapPath, tradeContext, type Action } from "../operations";

const slotIndex = z.number().int().min(0);
/** A full target list (not a diff): 1-20 unique assets by token address, bps summing to 10_000. */
const weightsSchema = z
  .array(z.object({ assetId: address, weightBps: z.number().int().min(0).max(BPS) }))
  .min(1)
  .max(MAX_ASSETS)
  .refine((w) => w.reduce((sum, x) => sum + x.weightBps, 0) === BPS, `must sum to ${BPS} bps`)
  .refine((w) => new Set(w.map((x) => x.assetId)).size === w.length, "each asset may appear only once");

/** Token addresses -> the factory's asset ids; each must be registered and active. */
function assetIdsOf(snap: Snapshot, weights: { assetId: string }[]) {
  return weights.map(({ assetId }) => {
    const a = snap.assets.find((x) => x.mint.toLowerCase() === assetId);
    if (!a?.exists || !a.active) throw badRequest("validation_failed", `weights: ${assetId} isn't an active asset`);
    return a.assetId;
  });
}
const slippageBps = z.number().int().min(0).max(5000).default(100);
const usd = (raw: bigint | null) => (raw === null ? null : formatUnits(raw, USDG_DECIMALS));

type ManagerCtx = Awaited<ReturnType<typeof managerContext>>;
type Prepared = { tx: TxRequest; amount?: bigint; data?: Record<string, string> };

export function managerRoutes(app: Hono<AppEnv>, { db, client }: Deps) {
  app.get("/manager/dtfs", async (c) => {
    const user = requireUser(c);
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const managed = await Promise.all(snap.vaults.map((v) => canManage(client, v, user.wallet_address as Address, project.factory)));
    return c.json({ items: snap.vaults.filter((_, i) => managed[i]).map((v) => toDtfRow(v, snap, project.chainId)) });
  });

  app.get("/manager/dtfs/:id", async (c) => {
    const { project, snap, vault: v } = await managerContext(c, client);
    const [view, tradingFeeBps] = await Promise.all([managerView(client, v, snap), getTradingFeeBps(client, project.factory)]);
    const usdg = snap.protocol.usdg.toLowerCase();
    const slots = view.slots.map((s) => ({
      index: s.index,
      assetId: s.mint.toLowerCase(),
      symbol: snap.assets.find((a) => a.assetId === s.assetId)?.symbol ?? null,
      targetBps: s.allocationBps,
      currentBps: s.currentBps,
      driftBps: s.currentBps === null ? null : s.currentBps - s.allocationBps,
      pendingDeployUsdc: usd(s.usdcTargetAmount),
      reservedRaw: String(s.reserved),
      balanceRaw: String(s.balance),
      valueUsdc: usd(s.valueUsdc),
      pendingWriteOff: s.pendingWriteOff,
      pendingReactivate: s.pendingReactivate,
    }));
    const actions = [
      ...(v.genesisDone ? [] : [{ kind: "genesis" as const }]),
      ...slots.filter((s, i) => view.slots[i]!.usdcTargetAmount > 0n).map((s) => ({ kind: "deploy" as const, slotIndex: s.index, amountUsdc: s.pendingDeployUsdc })),
      // A weighted USDG slot isn't traded itself; it moves as the other slots rebalance.
      ...slots
        .filter((s) => s.driftBps !== null && Math.abs(s.driftBps) > REBALANCE_DRIFT_BPS && (s.targetBps === 0 || s.assetId !== usdg))
        .map((s) => ({ kind: "rebalance" as const, slotIndex: s.index, driftBps: s.driftBps })),
    ];
    return c.json({
      ...toDtfRow(v, snap, project.chainId),
      feeRecipient: v.feeRecipient.toLowerCase(),
      tradingFeeBps,
      status: { paused: v.paused, adminLocked: v.adminLocked, emergency: snap.protocol.isEmergency, genesisDone: v.genesisDone },
      totalPendingUsdc: usd(v.totalPendingUsdc),
      redeemQueue: { activeCount: Number(view.activeRedeemCount), escrowUsdc: usd(view.vaultRedeemEscrowTotal) },
      slots,
      actions,
    });
  });

  // Every manager tx: manager check → validate → operations row → the same TxDraft trades return.
  const prepare = (name: string, action: Action, build: (c: Ctx, ctx: ManagerCtx) => Promise<Prepared>) =>
    app.post(`/manager/dtfs/:id/${name}/prepare`, async (c) => {
      const ctx = await managerContext(c, client);
      const { tx, amount, data } = await build(c, ctx);
      const op = await insertOperation(db, ctx.project, ctx.user, ctx.vault, action, tx, { amount });
      return c.json(draft(op, tx, ctx.project.chainId, data));
    });

  // swap_paths stores asset → USDG routes; buys walk the same pools backwards.
  const sellPath = async (chainId: number, snap: Snapshot, mint: Address) =>
    (await swapPath(db, chainId, mint)) ?? [mint, snap.protocol.usdg];

  prepare("genesis", "manager_genesis", async (c, { snap, vault: v }) => {
    const body = await parseBody(
      c,
      z.object({ baselineSharePrice: z.string().regex(/^\d+(\.\d{1,9})?$/, "must be a USDG price with up to 9 decimals") }),
    );
    assertActive(v, snap);
    if (v.genesisDone) throw conflict("genesis_done", "This basket is already seeded.");
    const baseline = parseUnits(body.baselineSharePrice, BASELINE_PRICE_DECIMALS);
    // Vault.sol bounds: $0.00001 to $100,000 per share.
    if (baseline < 10_000n || baseline > 100_000n * 10n ** 9n) {
      throw badRequest("validation_failed", "baselineSharePrice: must be between 0.00001 and 100000");
    }
    // Like buy, the app approves first: genesisDeposit pulls GENESIS_SEED_USDC from the wallet.
    return {
      tx: buildGenesisDeposit(v.address, baseline),
      amount: GENESIS_SEED_USDC,
      data: { approveToken: snap.protocol.usdg.toLowerCase(), approveAmountRaw: String(GENESIS_SEED_USDC) },
    };
  });

  prepare("deploy", "manager_deploy", async (c, { project, snap, vault: v }) => {
    const body = await parseBody(c, z.object({ slotIndex, slippageBps }));
    const slot = slotAt(v, body.slotIndex);
    assertActive(v, snap);
    const amount = await client.readContract({ address: v.address, abi: VaultAbi, functionName: "usdcTargetAmountAt", args: [slot.index] });
    if (amount === 0n) throw conflict("nothing_to_deploy", "No new deposits are waiting to be invested in this asset.");
    const mint = mintOf(snap, slot.assetId)!;
    const path = [...(await sellPath(project.chainId, snap, mint))].reverse();
    const minOut = applySlippage(await swapFloor(client, snap.protocol.usdg, mint, amount, project.factory), body.slippageBps);
    return { tx: buildSwapUsdcToAsset(v.address, slot.index, path, minOut), amount };
  });

  prepare("rebalance", "manager_rebalance", async (c, { project, snap, vault: v }) => {
    const body = await parseBody(c, z.object({ slotIndex, slippageBps }));
    slotAt(v, body.slotIndex);
    assertActive(v, snap);
    const view = await managerView(client, v, snap);
    const s = view.slots[body.slotIndex]!;
    const leg = rebalanceLeg(view, body.slotIndex);
    const toUsdg = await sellPath(project.chainId, snap, s.mint);
    const [path, tokenIn, tokenOut] = leg.sell ? [toUsdg, s.mint, view.usdg] : [[...toUsdg].reverse(), view.usdg, s.mint];
    const minOut = applySlippage(await swapFloor(client, tokenIn, tokenOut, leg.amountIn, project.factory), body.slippageBps);
    return { tx: buildExecuteRebalance(v.address, body.slotIndex, path, minOut), amount: leg.amountIn };
  });

  prepare("allocations", "manager_allocations", async (c, { snap, vault: v }) => {
    const { weights } = await parseBody(c, z.object({ weights: weightsSchema }));
    const ids = assetIdsOf(snap, weights);
    return { tx: buildSetTargetAllocations(v.address, ids, weights.map((w) => w.weightBps)) };
  });

  prepare("pause", "manager_pause", async (c, { vault: v }) => {
    const { paused } = await parseBody(c, z.object({ paused: z.boolean() }));
    return { tx: buildSetPaused(v.address, paused) };
  });

  prepare("write-off", "manager_write_off", async (c, { snap, vault: v }) => {
    const { assetId } = await parseBody(c, z.object({ assetId: address }));
    const slot = v.slots.find((s) => mintOf(snap, s.assetId) === assetId);
    if (!slot) throw badRequest("validation_failed", "assetId: not in this basket");
    return { tx: buildProposeWriteOff(v.address, slot.assetId) };
  });

  prepare("reactivate", "manager_reactivate", async (c, { snap, vault: v }) => {
    const { assetId } = await parseBody(c, z.object({ assetId: address }));
    const id = snap.assets.find((a) => a.mint.toLowerCase() === assetId)?.assetId;
    if (id === undefined) throw badRequest("validation_failed", "assetId: unknown asset");
    if (!(await client.readContract({ address: v.address, abi: VaultAbi, functionName: "isWrittenOff", args: [id] }))) {
      throw conflict("not_written_off", "Only a written-off asset can be reactivated.");
    }
    return { tx: buildProposeReactivate(v.address, id) };
  });

  // Fees: every deposit / redeem fee is escrowed in the factory's FeeEscrow and the manager's 80% accrues to ONE balance
  // per manager wallet across all their vaults (credited to each vault's vaultManager; operators accrue nothing).
  const feeContext = async (c: Ctx) => {
    const user = requireUser(c);
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const wallet = user.wallet_address as Address;
    const escrow = await getFeeEscrow(client, project.factory);
    const claimable = escrow ? await getManagerClaimable(client, escrow, wallet, snap.protocol.usdg) : 0n;
    return { user, project, snap, wallet, escrow, claimable };
  };

  app.get("/manager/fees", async (c) => {
    const { snap, wallet, escrow, claimable } = await feeContext(c);
    return c.json({
      // false on a factory deployed before FeeEscrow: fees are then paid straight to each vault's fee recipient.
      available: escrow !== null,
      token: snap.protocol.usdg.toLowerCase(),
      claimable: usd(claimable),
      claimableRaw: String(claimable),
      baskets: snap.vaults.filter((v) => v.manager.toLowerCase() === wallet).length,
    });
  });

  app.post("/manager/fees/claim/prepare", async (c) => {
    const { user, project, snap, wallet, escrow, claimable } = await feeContext(c);
    const { recipient } = await parseBody(
      c,
      z.object({ recipient: address.refine((a) => a !== zeroAddress, "must not be the zero address").optional() }),
    );
    if (!escrow) throw conflict("fees_unavailable", "Fee claims aren't available on this deployment yet.");
    if (claimable === 0n) throw conflict("nothing_to_claim", "You have no fees to claim yet.");
    const tx = buildClaimManagerFees(escrow, snap.protocol.usdg, (recipient ?? wallet) as Address);
    const op = await insertOperation(db, project, user, { address: escrow }, "manager_fee_claim", tx, { amount: claimable });
    return c.json(draft(op, tx, project.chainId));
  });
}

/** Vault.onlyManager: the vault's manager, or an operator the super-admin scoped to this vault. */
async function canManage(client: Deps["client"], v: VaultState, wallet: Address, factory: Address) {
  return v.manager.toLowerCase() === wallet || isVaultOperator(client, v.address, wallet, factory);
}

async function managerContext(c: Ctx, client: Deps["client"]) {
  const ctx = await tradeContext(c, client);
  if (!(await canManage(client, ctx.vault, ctx.user.wallet_address as Address, ctx.project.factory))) {
    throw new ApiError(403, "not_manager", "This wallet doesn't manage this basket.");
  }
  return ctx;
}

const managerView = (client: Deps["client"], v: VaultState, snap: Snapshot) =>
  getManagerView(client, v.address, v.slots.map((s) => ({ ...s, mint: mintOf(snap, s.assetId)! })), snap.protocol.factory);

function slotAt(v: VaultState, index: number) {
  const slot = v.slots[index];
  if (!slot) throw badRequest("validation_failed", `slotIndex: this basket has ${v.slots.length} assets`);
  return slot;
}

/** Vault.whenActive: genesis, deploy and rebalance revert while paused, admin-locked or in a protocol emergency. */
function assertActive(v: VaultState, snap: Snapshot) {
  if (v.paused) throw conflict("not_active", "This basket is paused. Unpause it first.");
  if (v.adminLocked) throw conflict("not_active", "This basket is locked by the protocol admin.");
  if (snap.protocol.isEmergency) throw conflict("not_active", "The protocol is in emergency mode.");
}

/** The trade executeRebalance makes for slot `i` (mirrors Vault._rebalanceTowardTarget); 409 when it would do nothing. */
function rebalanceLeg(view: ManagerView, i: number): { sell: boolean; amountIn: bigint } {
  const s = view.slots[i]!;
  // A 0% slot sells everything free, then retires once only dust is left.
  if (s.allocationBps === 0) return { sell: true, amountIn: s.free };
  if (s.mint.toLowerCase() === view.usdg.toLowerCase()) {
    throw conflict("nothing_to_rebalance", "USDG moves when the other assets are rebalanced.");
  }
  if (s.currentBps === null || s.valueUsdc === null || !view.freeNav) {
    throw conflict("no_price", "Asset weights can't be read right now (stale price or empty basket).");
  }
  const drift = s.currentBps - s.allocationBps;
  if (Math.abs(drift) <= REBALANCE_DRIFT_BPS) throw conflict("nothing_to_rebalance", "This asset is already within 0.5% of its target.");
  const delta = (BigInt(Math.abs(drift)) * view.freeNav) / BigInt(BPS);
  // Overweight sells the excess; underweight buys only with USDG not owed to pending deposits or redeemers.
  const leg =
    drift > 0
      ? { sell: true, amountIn: s.valueUsdc === 0n ? 0n : (s.free * delta) / s.valueUsdc }
      : { sell: false, amountIn: delta < view.freeUsdg ? delta : view.freeUsdg };
  if (leg.amountIn === 0n) throw conflict("nothing_to_rebalance", "There's no free USDG to buy with yet.");
  return leg;
}

/**
 * Creating a basket: open to the protocol super-admin and wallets it allowlisted as vault creators (factory
 * setVaultCreator). The creator's wallet becomes the basket's manager.
 */
export function createRoutes(app: Hono<AppEnv>, { db, client, logos }: Deps) {
  app.get("/manager/create", async (c) => {
    const user = requireUser(c);
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const active = snap.assets.filter((a) => a.exists && a.active);
    const [canCreate, priced, logoOf] = await Promise.all([
      canCreateVault(client, user.wallet_address as Address, project.factory),
      hasPrices(client, active.map((a) => a.mint), project.factory),
      logos?.(project.chainId) ?? new Map<string, string>(),
    ]);
    const usdg = snap.protocol.usdg.toLowerCase();
    return c.json({
      canCreate,
      assets: active.map((a, i) => ({
        id: a.mint.toLowerCase(),
        symbol: a.symbol ?? "?",
        name: a.name ?? a.mint,
        logoUrl: logoOf.get(a.mint.toLowerCase()) ?? null,
        // createVault needs a price for every asset but USDG.
        selectable: a.mint.toLowerCase() === usdg || priced[i]!,
      })),
      limits: { maxAssets: MAX_ASSETS, maxEntryFeeBps: MAX_DEPOSIT_FEE_BPS, minExitFeeBps: MIN_REDEEM_FEE_BPS, maxExitFeeBps: MAX_REDEEM_FEE_BPS },
    });
  });

  app.post("/manager/create/prepare", async (c) => {
    const user = requireUser(c);
    const project = c.get("project");
    const body = await parseBody(
      c,
      z
        .object({
          name: z.string().trim().min(1).max(64),
          symbol: z.string().trim().toUpperCase().regex(/^[A-Z0-9]{2,11}$/, "use 2-11 letters or numbers"),
          weights: weightsSchema,
          entryFeeBps: z.number().int().min(0).max(MAX_DEPOSIT_FEE_BPS),
          exitFeeBps: z.number().int().min(MIN_REDEEM_FEE_BPS).max(MAX_REDEEM_FEE_BPS),
          // Fixed funds cap their total shares; dynamic ones don't.
          fundType: z.enum(["dynamic", "fixed"]).default("dynamic"),
          maxShares: amount6.optional(),
          feeRecipient: address.refine((a) => a !== zeroAddress, "must not be the zero address").optional(),
        })
        .refine((b) => b.fundType === "dynamic" || (b.maxShares !== undefined && parseUnits(b.maxShares, SHARE_DECIMALS) > 0n), {
          message: "a fixed basket needs maxShares above 0",
          path: ["maxShares"],
        }),
    );
    const snap = await snapshot(client, project.factory);
    if (snap.protocol.isEmergency) throw conflict("not_active", "The protocol is in emergency mode.");
    if (snap.protocol.router === zeroAddress) throw conflict("no_router", "Swaps aren't set up on this deployment yet.");
    if (!(await canCreateVault(client, user.wallet_address as Address, project.factory))) {
      throw new ApiError(403, "not_vault_creator", "This wallet isn't approved to create baskets. Ask the Zeno team to allowlist it.");
    }
    const ids = assetIdsOf(snap, body.weights);
    const usdg = snap.protocol.usdg.toLowerCase();
    const needPrice = body.weights.map((w) => w.assetId).filter((a) => a !== usdg) as Address[];
    const priced = await hasPrices(client, needPrice, project.factory);
    const unpriced = needPrice.filter((_, i) => !priced[i]);
    if (unpriced.length) throw badRequest("no_price", `weights: no price yet for ${unpriced.join(", ")}`);

    const tx = buildCreateVault(project.factory, {
      name: body.name,
      symbol: body.symbol,
      assetIds: ids,
      allocationBps: body.weights.map((w) => w.weightBps),
      depositFeeBps: body.entryFeeBps,
      redeemFeeBps: body.exitFeeBps,
      fundType: body.fundType === "fixed" ? 0 : 1,
      maxShares: body.fundType === "fixed" ? parseUnits(body.maxShares!, SHARE_DECIMALS) : 0n,
      feeRecipient: (body.feeRecipient ?? zeroAddress) as Address,
    });
    const op = await insertOperation(db, project, user, { address: project.factory }, "manager_create", tx, {});
    return c.json(draft(op, tx, project.chainId));
  });
}
