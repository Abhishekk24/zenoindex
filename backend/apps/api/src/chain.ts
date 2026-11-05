import { getAssets, getProtocol, getVault, listVaults, activeChain, SHARE_DECIMALS, USDG_DECIMALS } from "@zenoindex/sdk";
import { erc20Abi, formatUnits, type Address, type PublicClient } from "viem";
import { notFound } from "./errors";

export type Snapshot = {
  protocol: Awaited<ReturnType<typeof getProtocol>>;
  vaults: Awaited<ReturnType<typeof getVault>>[];
  assets: Awaited<ReturnType<typeof getAssets>>;
};
export type VaultState = Snapshot["vaults"][number];

const TTL_MS = 10_000;
const caches = new WeakMap<PublicClient, Map<string, { at: number; value: Promise<Snapshot> }>>();

/** Confirmed writes must be visible to the very next screen / preparation step. */
export function invalidateSnapshot(client: PublicClient, factory: Address) {
  caches.get(client)?.delete(factory);
}

/** Everything the read endpoints need, read straight from the chain. */
export function snapshot(client: PublicClient, factory: Address): Promise<Snapshot> {
  // shortcut: per-process 10s cache; move to a shared cache / the indexer when running more than one instance.
  let cache = caches.get(client);
  if (!cache) caches.set(client, (cache = new Map()));
  const hit = cache.get(factory);
  if (hit && Date.now() - hit.at < TTL_MS) return hit.value;
  const value = (async () => {
    const [protocol, addrs, assets] = await Promise.all([
      getProtocol(client, factory),
      listVaults(client, factory),
      getAssets(client, factory),
    ]);
    return { protocol, assets, vaults: await Promise.all(addrs.map((a) => getVault(client, a))) };
  })();
  cache.set(factory, { at: Date.now(), value });
  value.catch(() => cache.delete(factory));
  return value;
}

export function findVault(snap: Snapshot, id: string) {
  const v = snap.vaults.find((x) => x.address.toLowerCase() === id.toLowerCase());
  if (!v) throw notFound("Basket");
  return v;
}

export const isTradable = (v: VaultState, snap: Snapshot) =>
  v.genesisDone && !v.paused && !v.adminLocked && !snap.protocol.isEmergency && v.totalNav !== null;

export const mintOf = (snap: Snapshot, assetId: bigint) => snap.assets.find((a) => a.assetId === assetId)?.mint.toLowerCase() as Address | undefined;

/** `DtfRow` as read by zenoIndex-mobile-app/src/lib/adapters.ts toDtf. Addresses lowercase, money as decimal strings. */
export function toDtfRow(v: VaultState, snap: Snapshot, chainId: number) {
  const nav = v.totalNav === null ? null : formatUnits(v.totalNav, USDG_DECIMALS);
  return {
    id: v.address.toLowerCase(),
    chainId,
    name: v.name,
    symbol: v.symbol,
    manager: v.manager.toLowerCase(),
    contractAddress: v.sharesToken.toLowerCase(),
    baseAssetId: snap.protocol.usdg.toLowerCase(),
    baseAssetDecimals: USDG_DECIMALS,
    shareDecimals: SHARE_DECIMALS,
    weights: v.slots.map((s) => ({ assetId: mintOf(snap, s.assetId) ?? String(s.assetId), weightBps: s.allocationBps })),
    ...(nav !== null && { nav }),
    sharePrice: v.sharePrice === null ? "0" : formatUnits(v.sharePrice, USDG_DECIMALS),
    aum: nav ?? "0",
    fees: { entryBps: v.depositFeeBps, exitBps: v.redeemFeeBps, managementBps: 0 },
    strategyType: "standard" as const,
    asOf: new Date().toISOString(),
    lifecycle: isTradable(v, snap) ? "active" : "coming_soon",
    totalSupplyRaw: v.totalShares.toString(),
  };
}

export async function holdings(client: PublicClient, v: VaultState, snap: Snapshot) {
  const mints = v.slots.map((s) => mintOf(snap, s.assetId));
  const balances = await client.multicall({
    contracts: mints.map((m) => ({ address: m!, abi: erc20Abi, functionName: "balanceOf", args: [v.address] }) as const),
  });
  return v.slots.map((s, i) => ({
    assetId: mints[i] ?? String(s.assetId),
    quantityRaw: balances[i]?.status === "success" ? String(balances[i]!.result) : "0",
    targetWeightBps: s.allocationBps,
  }));
}

export const publicRpcUrl = activeChain.rpcUrls.default.http[0];
export const explorerUrl = activeChain.blockExplorers.default.url;
