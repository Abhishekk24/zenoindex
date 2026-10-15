import { erc20Abi, zeroAddress, type Address, type PublicClient } from "viem";
import { AccessMasterAbi, FeeEscrowAbi, VaultAbi, ZenoIndexVaultAbi } from "./abis";
import { BPS, MAINNET, SHARE_DECIMALS } from "./constants";

const range = (n: number) => Array.from({ length: n }, (_, i) => i);

function unwrap<T>(r: { status: "success"; result: T } | { status: "failure"; error: Error }, what: string): T {
  if (r.status === "failure") throw new Error(`${what}: ${r.error.message}`);
  return r.result;
}

/** Protocol-wide settings on the factory. */
export async function getProtocol(client: PublicClient, factory: Address = MAINNET.factory) {
  const c = { address: factory, abi: ZenoIndexVaultAbi } as const;
  const [usdg, router, isEmergency, totalVaults, totalAssets, maxPriceAge, maxSwapSlippageBps, treasury] =
    await client.multicall({
      allowFailure: false,
      contracts: [
        { ...c, functionName: "usdcToken" },
        { ...c, functionName: "router" },
        { ...c, functionName: "isEmergency" },
        { ...c, functionName: "totalVaults" },
        { ...c, functionName: "totalAssets" },
        { ...c, functionName: "maxPriceAge" },
        { ...c, functionName: "maxSwapSlippageBps" },
        { ...c, functionName: "treasury" },
      ],
    });
  return { factory, usdg, router, isEmergency, totalVaults, totalAssets, maxPriceAge, maxSwapSlippageBps, treasury };
}

/** All vault clone addresses, in vaultId order (ids start at 0). */
export async function listVaults(client: PublicClient, factory: Address = MAINNET.factory): Promise<Address[]> {
  const n = await client.readContract({ address: factory, abi: ZenoIndexVaultAbi, functionName: "totalVaults" });
  if (n === 0n) return [];
  return client.multicall({
    allowFailure: false,
    contracts: range(Number(n)).map(
      (i) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName: "vaultClones", args: [BigInt(i)] }) as const,
    ),
  });
}

/** Registered assets (ids start at 0) with their ERC-20 metadata. */
export async function getAssets(client: PublicClient, factory: Address = MAINNET.factory) {
  const n = await client.readContract({ address: factory, abi: ZenoIndexVaultAbi, functionName: "totalAssets" });
  if (n === 0n) return [];
  const infos = await client.multicall({
    allowFailure: false,
    contracts: range(Number(n)).map(
      (i) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName: "getAsset", args: [BigInt(i)] }) as const,
    ),
  });
  // allowFailure: a non-standard token (e.g. bytes32 symbol) shouldn't hide the whole list.
  const [symbols, names, decimals] = await Promise.all([
    client.multicall({ contracts: infos.map(([, mint]) => ({ address: mint, abi: erc20Abi, functionName: "symbol" }) as const) }),
    client.multicall({ contracts: infos.map(([, mint]) => ({ address: mint, abi: erc20Abi, functionName: "name" }) as const) }),
    client.multicall({ contracts: infos.map(([, mint]) => ({ address: mint, abi: erc20Abi, functionName: "decimals" }) as const) }),
  ]);
  const ok = <T>(r: { status: string; result?: T } | undefined): T | null =>
    r?.status === "success" ? (r.result as T) : null;
  return infos.map(([assetId, mint, active, exists], i) => ({
    assetId,
    mint,
    active,
    exists,
    symbol: ok<string>(symbols[i]),
    name: ok<string>(names[i]),
    decimals: ok<number>(decimals[i]),
  }));
}

/**
 * Full state of one vault. `totalNav` is null when it reverts (stale or missing price) —
 * in that state deposits and redeem swaps revert too.
 */
export async function getVault(client: PublicClient, vault: Address) {
  const c = { address: vault, abi: VaultAbi } as const;
  const r = await client.multicall({
    contracts: [
      { ...c, functionName: "vaultId" },
      { ...c, functionName: "sharesToken" },
      { ...c, functionName: "vaultManager" },
      { ...c, functionName: "feeRecipient" },
      { ...c, functionName: "fundType" },
      { ...c, functionName: "depositFeeBps" },
      { ...c, functionName: "redeemFeeBps" },
      { ...c, functionName: "maxShares" },
      { ...c, functionName: "paused" },
      { ...c, functionName: "adminLocked" },
      { ...c, functionName: "genesisDone" },
      { ...c, functionName: "totalShares" },
      { ...c, functionName: "numAssets" },
      { ...c, functionName: "totalPendingUsdc" },
      { ...c, functionName: "totalNav" },
    ],
  });
  const sharesToken = unwrap(r[1], "sharesToken");
  const numAssets = unwrap(r[12], "numAssets");
  const totalShares = unwrap(r[11], "totalShares");
  const totalNav = r[14].status === "success" ? r[14].result : null;

  const [[name, symbol], assetIds, allocations] = await Promise.all([
    client.multicall({
      allowFailure: false,
      contracts: [
        { address: sharesToken, abi: erc20Abi, functionName: "name" },
        { address: sharesToken, abi: erc20Abi, functionName: "symbol" },
      ],
    }),
    client.multicall({
      allowFailure: false,
      contracts: range(numAssets).map((i) => ({ ...c, functionName: "assetIdAt", args: [i] }) as const),
    }),
    client.multicall({
      allowFailure: false,
      contracts: range(numAssets).map((i) => ({ ...c, functionName: "allocationBpsAt", args: [i] }) as const),
    }),
  ]);
  const slots = range(numAssets).map((i) => ({ index: i, assetId: assetIds[i]!, allocationBps: allocations[i]! }));

  return {
    address: vault,
    vaultId: unwrap(r[0], "vaultId"),
    name,
    symbol,
    sharesToken,
    manager: unwrap(r[2], "vaultManager"),
    feeRecipient: unwrap(r[3], "feeRecipient"),
    fundType: unwrap(r[4], "fundType") === 0 ? ("fixed" as const) : ("dynamic" as const),
    depositFeeBps: unwrap(r[5], "depositFeeBps"),
    redeemFeeBps: unwrap(r[6], "redeemFeeBps"),
    maxShares: unwrap(r[7], "maxShares"),
    paused: unwrap(r[8], "paused"),
    adminLocked: unwrap(r[9], "adminLocked"),
    genesisDone: unwrap(r[10], "genesisDone"),
    totalShares,
    totalPendingUsdc: unwrap(r[13], "totalPendingUsdc"),
    totalNav,
    sharePrice: sharePrice(totalNav, totalShares),
    slots,
  };
}

/** USDG (6-dec raw) per 1 whole share; null when NAV is unreadable or no shares exist. */
export function sharePrice(totalNav: bigint | null, totalShares: bigint): bigint | null {
  if (totalNav === null || totalShares === 0n) return null;
  return (totalNav * 10n ** BigInt(SHARE_DECIMALS)) / totalShares;
}

export async function previewDeposit(client: PublicClient, vault: Address, usdgAmount: bigint) {
  const [sharesOut, netUsdc, companyFee, managerFee] = await client.readContract({
    address: vault,
    abi: VaultAbi,
    functionName: "previewDeposit",
    args: [usdgAmount],
  });
  return { sharesOut, netUsdc, companyFee, managerFee };
}

/** Floor the factory enforces on a swap's output (reverts on stale/missing price). */
export function swapFloor(client: PublicClient, tokenIn: Address, tokenOut: Address, amountIn: bigint, factory: Address = MAINNET.factory) {
  return client.readContract({
    address: factory,
    abi: ZenoIndexVaultAbi,
    functionName: "swapFloor",
    args: [tokenIn, tokenOut, amountIn],
  });
}

/** Operators a super-admin scoped to `vault` pass Vault.onlyManager just like `vaultManager`. */
export function isVaultOperator(client: PublicClient, vault: Address, account: Address, factory: Address = MAINNET.factory) {
  return client.readContract({ address: factory, abi: ZenoIndexVaultAbi, functionName: "isVaultOperator", args: [vault, account] });
}

/**
 * What a manager needs beyond getVault, valued the way executeRebalance sees it: a slot's weight is the USDG
 * value of its free (unreserved) balance over the vault's free NAV — pending deposits and redeem escrow excluded.
 * `slots[i]` is slot i with its token (from getAssets). Values and weights are null when a price is stale or missing.
 */
export async function getManagerView(
  client: PublicClient,
  vault: Address,
  slots: readonly { assetId: bigint; allocationBps: number; mint: Address }[],
  factory: Address = MAINNET.factory,
) {
  const c = { address: vault, abi: VaultAbi } as const;
  const [[activeRedeemCount, vaultRedeemEscrowTotal, totalPendingUsdc, usdg], targets, reserved, balances, writeOffs, reactivates] =
    await Promise.all([
      client.multicall({
        allowFailure: false,
        contracts: [
          { ...c, functionName: "activeRedeemCount" },
          { ...c, functionName: "vaultRedeemEscrowTotal" },
          { ...c, functionName: "totalPendingUsdc" },
          { address: factory, abi: ZenoIndexVaultAbi, functionName: "usdcToken" },
        ],
      }),
      client.multicall({ allowFailure: false, contracts: slots.map((_, i) => ({ ...c, functionName: "usdcTargetAmountAt", args: [i] }) as const) }),
      client.multicall({ allowFailure: false, contracts: slots.map((_, i) => ({ ...c, functionName: "reservedAt", args: [i] }) as const) }),
      client.multicall({
        allowFailure: false,
        contracts: slots.map((s) => ({ address: s.mint, abi: erc20Abi, functionName: "balanceOf", args: [vault] }) as const),
      }),
      client.multicall({ allowFailure: false, contracts: slots.map((s) => ({ ...c, functionName: "pendingWriteOff", args: [s.assetId] }) as const) }),
      client.multicall({ allowFailure: false, contracts: slots.map((s) => ({ ...c, functionName: "pendingReactivate", args: [s.assetId] }) as const) }),
    ]);

  const isUsdg = (m: Address) => m.toLowerCase() === usdg.toLowerCase();
  const earmarked = totalPendingUsdc + vaultRedeemEscrowTotal;
  const sub = (a: bigint, b: bigint) => (a > b ? a - b : 0n);
  // Same as Vault._freeBalance: a USDG slot's cash owed to pending deployment or redeemers isn't free.
  const free = slots.map((s, i) => sub(balances[i]!, reserved[i]! + (isUsdg(s.mint) ? earmarked : 0n)));

  const [values, usdgBalance] = await Promise.all([
    client.multicall({
      contracts: slots.map((s, i) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName: "valueUsdc", args: [s.mint, free[i]!] }) as const),
    }),
    client.readContract({ address: usdg, abi: erc20Abi, functionName: "balanceOf", args: [vault] }),
  ]);
  const valueUsdc = values.map((r) => (r.status === "success" ? r.result : null));
  /** USDG the vault can spend on buys (Vault._rebalanceTowardTarget's `usdcFree`). */
  const freeUsdg = sub(usdgBalance, earmarked);
  // Factory.sumNav: free slot values, plus free USDG when no slot holds USDG.
  const freeNav = valueUsdc.includes(null)
    ? null
    : valueUsdc.reduce<bigint>((a, v) => a + v!, 0n) + (slots.some((s) => isUsdg(s.mint)) ? 0n : freeUsdg);

  return {
    usdg,
    activeRedeemCount,
    vaultRedeemEscrowTotal,
    totalPendingUsdc,
    freeUsdg,
    freeNav,
    slots: slots.map((s, i) => ({
      index: i,
      assetId: s.assetId,
      mint: s.mint,
      allocationBps: s.allocationBps,
      usdcTargetAmount: targets[i]!,
      reserved: reserved[i]!,
      balance: balances[i]!,
      free: free[i]!,
      valueUsdc: valueUsdc[i] ?? null,
      currentBps: freeNav === null || freeNav === 0n ? null : Number((valueUsdc[i]! * BigInt(BPS)) / freeNav),
      pendingWriteOff: writeOffs[i]!,
      pendingReactivate: reactivates[i]!,
    })),
  };
}

export type ManagerView = Awaited<ReturnType<typeof getManagerView>>;

export type RedeemLeg = { index: number; assetId: bigint; amountIn: bigint; swapped: boolean };
export type RedeemProgress = { active: boolean; escrowUsdc: bigint; legs: RedeemLeg[] };

/** The user's open redeem, if any. Legs for USDG slots are already marked swapped (amount 0). */
export async function getRedeemProgress(client: PublicClient, vault: Address, user: Address): Promise<RedeemProgress> {
  const c = { address: vault, abi: VaultAbi } as const;
  const [active, n, escrowUsdc] = await client.readContract({ ...c, functionName: "getRedeemState", args: [user] });
  if (!active) return { active, escrowUsdc, legs: [] };
  // getRedeemAssetAmount has no bounds check, so only read i < n.
  const [amounts, assetIds] = await Promise.all([
    client.multicall({
      allowFailure: false,
      contracts: range(n).map((i) => ({ ...c, functionName: "getRedeemAssetAmount", args: [user, i] }) as const),
    }),
    client.multicall({
      allowFailure: false,
      contracts: range(n).map((i) => ({ ...c, functionName: "assetIdAt", args: [i] }) as const),
    }),
  ]);
  const legs = range(n).map((i) => {
    const [amountIn, swapped] = amounts[i]!;
    return { index: i, assetId: assetIds[i]!, amountIn, swapped };
  });
  return { active, escrowUsdc, legs };
}

export type RedeemStep =
  | { kind: "request" }
  | { kind: "swap"; leg: RedeemLeg; remaining: number }
  | { kind: "claim" }
  | { kind: "claimInKind" };

/**
 * Next transaction in the redeem flow: requestRedeem → swapAssetToUsdc per open leg → claim.
 * `inKind` skips the swaps and settles with claimInKind (basket tokens instead of USDG).
 * `remaining` counts the swaps still open including this one; a claim always follows them.
 */
export function nextRedeemStep(progress: RedeemProgress, opts: { inKind?: boolean } = {}): RedeemStep {
  if (!progress.active) return { kind: "request" };
  if (opts.inKind) return { kind: "claimInKind" };
  const open = progress.legs.filter((l) => !l.swapped && l.amountIn > 0n);
  const leg = open[0];
  return leg ? { kind: "swap", leg, remaining: open.length } : { kind: "claim" };
}

/**
 * The factory's FeeEscrow, or null when it has none: a factory deployed before FeeEscrow (no `feeEscrow()`, so the
 * call reverts) or one whose escrow isn't set yet.
 */
export async function getFeeEscrow(client: PublicClient, factory: Address = MAINNET.factory): Promise<Address | null> {
  const escrow = await client
    .readContract({ address: factory, abi: ZenoIndexVaultAbi, functionName: "feeEscrow" })
    .catch(() => null);
  return escrow && escrow !== zeroAddress ? escrow : null;
}

/** `manager`'s unclaimed fees in `token` — one balance across all the vaults they manage. */
export async function getManagerClaimable(client: PublicClient, escrow: Address, manager: Address, token: Address) {
  return client.readContract({ address: escrow, abi: FeeEscrowAbi, functionName: "managerClaimable", args: [manager, token] });
}

/**
 * The fee (bps, ≤ 200) every executeRebalance swap pays on its output into the FeeEscrow, set on AccessMaster by the
 * admin. 0 on a deployment from before it (no `tradingFeeBps()`, so the call reverts).
 */
export async function getTradingFeeBps(client: PublicClient, factory: Address = MAINNET.factory): Promise<number> {
  try {
    const accessMaster = await client.readContract({ address: factory, abi: ZenoIndexVaultAbi, functionName: "accessMaster" });
    return await client.readContract({ address: accessMaster, abi: AccessMasterAbi, functionName: "tradingFeeBps" });
  } catch {
    return 0;
  }
}

/** createVault is open to the protocol super-admin and wallets the super-admin allowlisted as vault creators. */
export async function canCreateVault(client: PublicClient, account: Address, factory: Address = MAINNET.factory) {
  const c = { address: factory, abi: ZenoIndexVaultAbi } as const;
  const [creator, superAdmin] = await client.multicall({
    allowFailure: false,
    contracts: [
      { ...c, functionName: "isVaultCreator", args: [account] },
      { ...c, functionName: "superAdmin" },
    ],
  });
  return creator || superAdmin.toLowerCase() === account.toLowerCase();
}

/** Whether the factory has a price for each token (createVault needs one for every non-USDG asset). */
export async function hasPrices(client: PublicClient, tokens: readonly Address[], factory: Address = MAINNET.factory) {
  if (tokens.length === 0) return [];
  return client.multicall({
    allowFailure: false,
    contracts: tokens.map((t) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName: "hasPrice", args: [t] }) as const),
  });
}
