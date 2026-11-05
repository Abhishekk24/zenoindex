// Basket stats for GET /dtfs/:id: NAV history (daily snapshots), share-price changes, and recent on-chain activity.
import { MAINNET, VaultAbi, ZenoIndexVaultAbi } from "@zenoindex/sdk";
import { formatUnits, parseEventLogs, parseUnits, type Address, type PublicClient } from "viem";
import { snapshot, toDtfRow, type Snapshot } from "./chain";
import type { Db } from "./db";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_DECIMALS = 6;
/** Demo history until a basket has this many real daily snapshots (a week). */
export const MIN_REAL_POINTS = 7;

export type NavPoint = {
  observedAt: string;
  navValue: string;
  sharePrice: string;
  totalSupplyRaw: string;
  valuationStatus: "accepted";
};

/**
 * One row per vault with a valuation (a vault with a stale price has none) and one per priced asset, at most one per
 * ~day: a restart or deploy within 20h of the last snapshot adds nothing.
 */
export async function snapshotNav(db: Db, client: PublicClient) {
  const { rows: projects } = await db.query<{ id: string; chain_id: number; factory_address: string }>(
    "select id, chain_id, factory_address from projects",
  );
  let saved = 0;
  let assets = 0;
  for (const p of projects) {
    const snap = await snapshot(client, p.factory_address as Address);
    for (const v of snap.vaults) {
      const row = toDtfRow(v, snap, p.chain_id);
      if (row.nav === undefined) continue;
      const { rows } = await db.query(
        `insert into nav_snapshots (project_id, vault_address, share_price, nav, total_supply_raw)
         select $1, $2, $3, $4, $5
         where not exists (select 1 from nav_snapshots where project_id = $1 and vault_address = $2 and observed_at > now() - interval '20 hours')
         returning 1`,
        [p.id, row.id, row.sharePrice, row.nav, row.totalSupplyRaw],
      );
      saved += rows.length;
    }
    for (const a of await assetPrices(client, snap)) {
      if (a.priceUsdg === null) continue;
      const { rows } = await db.query(
        `insert into asset_price_snapshots (project_id, asset_address, price)
         select $1, $2, $3
         where not exists (select 1 from asset_price_snapshots where project_id = $1 and asset_address = $2 and observed_at > now() - interval '20 hours')
         returning 1`,
        [p.id, a.mint, a.priceUsdg],
      );
      assets += rows.length;
    }
  }
  return { baskets: saved, assets };
}

/**
 * USDG per whole token for every active asset, from the factory's price table, with when it was last set. USDG itself is 1. null price: not set yet. Stale prices are still reported (the app shows the age).
 */
export async function assetPrices(client: PublicClient, snap: Snapshot) {
  const usdg = snap.protocol.usdg.toLowerCase();
  const assets = snap.assets.filter((a) => a.exists && a.active);
  const factory = snap.protocol.factory;
  const priced = assets.filter((a) => a.mint.toLowerCase() !== usdg);
  // The raw table, not valueUsdc: that quote reverts (StalePrice) once a price is older than maxPriceAge.
  const read = (functionName: "priceNum" | "priceDen" | "priceUpdatedAt") =>
    client.multicall({ contracts: priced.map((a) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName, args: [a.mint] }) as const) });
  // Factories with Chainlink feeds price through getPrice (feed, else table); it reverts when stale or on older factories.
  const live = client.multicall({ contracts: priced.map((a) => ({ address: factory, abi: ZenoIndexVaultAbi, functionName: "getPrice", args: [a.mint] }) as const) });
  const [nums, dens, updated, prices] = await Promise.all([read("priceNum"), read("priceDen"), read("priceUpdatedAt"), live]);
  const ok = (r: { status: string; result?: bigint } | undefined) => (r?.status === "success" ? r.result! : 0n);
  const byMint = new Map(
    priced.map((a, i) => {
      const p = prices[i];
      const [num, den] = p?.status === "success" ? p.result! : [ok(nums[i]), ok(dens[i])];
      const at = ok(updated[i]);
      // value(amount) = amount * num / den in USDG raw; one whole token = 10^decimals.
      const price = den > 0n ? formatUnits((10n ** BigInt(a.decimals ?? 18) * num) / den, PRICE_DECIMALS) : null;
      return [a.mint.toLowerCase(), { priceUsdg: price, priceUpdatedAt: at > 0n ? new Date(Number(at) * 1000).toISOString() : null }];
    }),
  );
  return assets.map((a) => {
    const mint = a.mint.toLowerCase();
    return mint === usdg ? { mint, priceUsdg: "1", priceUpdatedAt: null } : { mint, ...byMint.get(mint)! };
  });
}

/** An asset's 24h / 30d price change for GET /assets: real daily snapshots, or (demo stats on, under a week) demo ones. */
export async function assetStats(db: Db, projectId: string, mint: string, priceUsdg: string | null, demoStats: boolean) {
  if (priceUsdg === null) return null;
  const { rows } = await db.query<{ observed_at: Date; price: string }>(
    "select observed_at, price from asset_price_snapshots where project_id = $1 and asset_address = $2 order by observed_at",
    [projectId, mint],
  );
  const real: NavPoint[] = rows.map((r) => ({
    observedAt: new Date(r.observed_at).toISOString(),
    sharePrice: r.price,
    navValue: "0",
    totalSupplyRaw: "0",
    valuationStatus: "accepted",
  }));
  const demo = real.length < MIN_REAL_POINTS && demoStats;
  const points = demo ? demoHistory(mint, { sharePrice: priceUsdg, nav: "0", totalSupplyRaw: "0" }) : real;
  return listStats({ points, demo });
}

/** Snapshots every basket now and then every `everyMs` (default 24h). Failures are logged and retried next tick. */
export function startNavWorker(db: Db, client: PublicClient, everyMs = DAY_MS) {
  const tick = () =>
    snapshotNav(db, client)
      .then((n) => console.log(`nav worker: saved ${n.baskets} basket and ${n.assets} asset price snapshot(s)`))
      .catch((e) => console.error(`nav worker: ${e instanceof Error ? e.message : e}`));
  void tick();
  const timer = setInterval(tick, everyMs);
  timer.unref();
  return () => clearInterval(timer);
}

export async function navHistory(db: Db, projectId: string, vault: string): Promise<NavPoint[]> {
  const { rows } = await db.query<{ observed_at: Date; share_price: string; nav: string; total_supply_raw: string }>(
    `select observed_at, share_price, nav, total_supply_raw from nav_snapshots
     where project_id = $1 and vault_address = $2 order by observed_at`,
    [projectId, vault.toLowerCase()],
  );
  return rows.map((r) => ({
    observedAt: new Date(r.observed_at).toISOString(),
    navValue: r.nav,
    sharePrice: r.share_price,
    totalSupplyRaw: r.total_supply_raw,
    valuationStatus: "accepted",
  }));
}

/** Deterministic PRNG (mulberry32) so a basket's demo chart is the same on every request. */
function seeded(seedText: string) {
  let a = [...seedText].reduce((h, ch) => (Math.imul(h ^ ch.charCodeAt(0), 2654435761) >>> 0), 2166136261);
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * DEMO DATA: a plausible daily NAV history ending exactly at the basket's real current price, for showing the charts
 * before a week of real daily snapshots exists. Marked `demo: true` in the response; the app labels it.
 */
export function demoHistory(vault: string, current: { sharePrice: string; nav: string; totalSupplyRaw: string }, days = 30): NavPoint[] {
  const rand = seeded(vault.toLowerCase());
  const now = Date.now();
  const end = Number(current.sharePrice) > 0 ? Number(current.sharePrice) : 1;
  const supply = Number(formatUnits(BigInt(current.totalSupplyRaw || "0"), PRICE_DECIMALS)) || 1;
  // Walk backwards from today: ~0.1%/day drift, ~1.2% daily swings.
  const prices = [end];
  for (let i = 1; i < days; i++) prices.unshift(prices[0]! / (1 + 0.001 + (rand() - 0.5) * 0.024));
  return prices.map((price, i) => ({
    observedAt: new Date(now - (days - 1 - i) * DAY_MS).toISOString(),
    navValue: (i === days - 1 && Number(current.nav) > 0 ? Number(current.nav) : price * supply).toFixed(PRICE_DECIMALS),
    sharePrice: price.toFixed(PRICE_DECIMALS),
    totalSupplyRaw: current.totalSupplyRaw || "0",
    valuationStatus: "accepted",
  }));
}

/** Share-price change since the previous point ("latest") and since the first ("inception"). */
export function priceDeltas(points: NavPoint[]) {
  if (points.length < 2) return [];
  const last = points[points.length - 1]!;
  const delta = (window: "latest" | "inception", from: NavPoint) => {
    const a = parseUnits(from.sharePrice, PRICE_DECIMALS);
    const b = parseUnits(last.sharePrice, PRICE_DECIMALS);
    return {
      window,
      fromObservedAt: from.observedAt,
      toObservedAt: last.observedAt,
      sharePriceDelta: formatUnits(b - a, PRICE_DECIMALS),
      sharePriceDeltaBps: a === 0n ? 0 : Number(((b - a) * 10_000n) / a),
    };
  };
  return [delta("latest", points[points.length - 2]!), delta("inception", points[0]!)];
}

const ACTIVITY = ["GenesisSeeded", "Deposit", "RequestRedeem", "Claim", "RedeemSettledInKind", "SwapUsdcToAsset", "RebalanceExecuted"] as const;
// Per chain client, so the app's one client shares it (and each test's fake client starts empty).
const activityCaches = new WeakMap<PublicClient, Map<string, { at: number; items: unknown[] }>>();

/**
 * The vault's latest events, newest first, in the app's transaction shape. Read straight from the chain (the public
 * RPC serves the whole range in one call); cached 60s per vault.
 * shortcut: scans from the factory deploy block on each refresh; have the worker store events once volume grows.
 */
export async function recentActivity(client: PublicClient, vault: Address, chainId: number, limit = 20) {
  const key = vault.toLowerCase();
  if (!activityCaches.has(client)) activityCaches.set(client, new Map());
  const activityCache = activityCaches.get(client)!;
  const hit = activityCache.get(key);
  if (hit && Date.now() - hit.at < 60_000) return hit.items;

  const raw = await client.getLogs({ address: vault, fromBlock: MAINNET.deployBlock, toBlock: "latest" });
  const logs = parseEventLogs({ abi: VaultAbi, logs: raw, eventName: [...ACTIVITY] }).slice(-limit).reverse();
  const blocks = new Map<bigint, string>();
  for (const n of new Set(logs.map((l) => l.blockNumber))) {
    const b = await client.getBlock({ blockNumber: n });
    blocks.set(n, new Date(Number(b.timestamp) * 1000).toISOString());
  }
  const items = logs.map((l) => {
    const a = l.args as Record<string, unknown>;
    const base = { id: `${l.transactionHash}:${l.logIndex}`, chainId, txHash: l.transactionHash, status: "confirmed", occurredAt: blocks.get(l.blockNumber)!, assetId: null };
    const wallet = (x: unknown) => (typeof x === "string" ? x.toLowerCase() : null);
    switch (l.eventName) {
      case "GenesisSeeded":
        return { ...base, action: "genesis", walletAddress: wallet(a.depositor), amountRaw: String(a.seedUsdc), shareAmountRaw: String(a.sharesMinted) };
      case "Deposit":
        return { ...base, action: "invest", walletAddress: wallet(a.user), amountRaw: String(a.usdcAmount), shareAmountRaw: String(a.sharesMinted) };
      case "RequestRedeem":
        return { ...base, action: "redeem", walletAddress: wallet(a.user), amountRaw: String(a.pendingUsdcCredited), shareAmountRaw: String(a.sharesBurned) };
      case "Claim":
        return { ...base, action: "claim", walletAddress: wallet(a.user), amountRaw: String(a.netUsdc), shareAmountRaw: null };
      case "RedeemSettledInKind":
        return { ...base, action: "claim_in_kind", walletAddress: wallet(a.user), amountRaw: String(a.usdcPaid), shareAmountRaw: null };
      case "SwapUsdcToAsset":
        return { ...base, action: "deploy", walletAddress: null, amountRaw: String(a.usdcIn), shareAmountRaw: null };
      default:
        return { ...base, action: "rebalance", walletAddress: null, amountRaw: String(a.amountTraded), shareAmountRaw: null };
    }
  });
  activityCache.set(key, { at: Date.now(), items });
  return items;
}

type Row = { id: string; sharePrice: string; nav?: string; totalSupplyRaw: string };

/** A basket's NAV history: the real daily snapshots, or (with demo stats on and under a week of them) the demo one. */
export async function basketSeries(db: Db, projectId: string, row: Row, demoStats: boolean) {
  const real = await navHistory(db, projectId, row.id);
  const demo = real.length < MIN_REAL_POINTS && demoStats;
  const points = demo ? demoHistory(row.id, { sharePrice: row.sharePrice, nav: row.nav ?? "0", totalSupplyRaw: row.totalSupplyRaw }) : real;
  return { points, demo };
}

const bpsBetween = (from: NavPoint | undefined, to: NavPoint | undefined) => {
  if (!from || !to) return null;
  const a = parseUnits(from.sharePrice, PRICE_DECIMALS);
  return a === 0n ? null : Number(((parseUnits(to.sharePrice, PRICE_DECIMALS) - a) * 10_000n) / a);
};

/** What a basket list card shows: 24h and 30-day share-price change and a 30-point sparkline. */
export function listStats({ points, demo }: { points: NavPoint[]; demo: boolean }) {
  const last = points.at(-1);
  const cutoff = last ? Date.parse(last.observedAt) - 30 * DAY_MS : 0;
  const monthAgo = points.find((p) => Date.parse(p.observedAt) >= cutoff);
  return {
    demo,
    change24hBps: bpsBetween(points.at(-2), last),
    change30dBps: points.length >= 2 ? bpsBetween(monthAgo, last) : null,
    sparkline: points.slice(-30).map((p) => p.sharePrice),
  };
}

/** A list row with its card stats. */
export async function withStats<T extends Row>(db: Db, projectId: string, row: T, demoStats: boolean) {
  return { ...row, stats: listStats(await basketSeries(db, projectId, row, demoStats)) };
}
