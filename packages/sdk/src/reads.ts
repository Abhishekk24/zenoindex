import { erc20Abi, type Address, type PublicClient } from "viem";
import { VaultAbi, ZenoIndexVaultAbi } from "./abis";
import { MAINNET, SHARE_DECIMALS } from "./constants";

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
