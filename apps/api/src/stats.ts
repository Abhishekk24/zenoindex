// Basket stats for GET /dtfs/:id: NAV history (daily snapshots), share-price changes, and recent on-chain activity.
import { MAINNET, VaultAbi } from "@zenoindex/sdk";
import { formatUnits, parseEventLogs, parseUnits, type Address, type PublicClient } from "viem";
import { snapshot, toDtfRow } from "./chain";
import type { Db } from "./db";

const DAY_MS = 24 * 60 * 60 * 1000;
const PRICE_DECIMALS = 6;

export type NavPoint = {
  observedAt: string;
  navValue: string;
  sharePrice: string;
  totalSupplyRaw: string;
  valuationStatus: "accepted";
};

/** One row per vault with a valuation (a vault with a stale price has none). */
export async function snapshotNav(db: Db, client: PublicClient) {
  const { rows: projects } = await db.query<{ id: string; chain_id: number; factory_address: string }>(
    "select id, chain_id, factory_address from projects",
  );
  let saved = 0;
  for (const p of projects) {
    const snap = await snapshot(client, p.factory_address as Address);
    for (const v of snap.vaults) {
      const row = toDtfRow(v, snap, p.chain_id);
      if (row.nav === undefined) continue;
      await db.query(
        "insert into nav_snapshots (project_id, vault_address, share_price, nav, total_supply_raw) values ($1, $2, $3, $4, $5)",
        [p.id, row.id, row.sharePrice, row.nav, row.totalSupplyRaw],
      );
      saved++;
    }
  }
  return saved;
}

/** Snapshots every basket now and then every `everyMs` (default 24h). Failures are logged and retried next tick. */
export function startNavWorker(db: Db, client: PublicClient, everyMs = DAY_MS) {
  const tick = () =>
    snapshotNav(db, client)
      .then((n) => console.log(`nav worker: saved ${n} snapshot(s)`))
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
 * before real snapshots exist (fewer than 2). Marked `demo: true` in the response; the app labels it.
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
