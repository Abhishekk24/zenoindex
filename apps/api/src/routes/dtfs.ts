import { robinhood, USDG_DECIMALS } from "@zenoindex/sdk";
import type { Hono } from "hono";
import { explorerUrl, findVault, holdings, publicRpcUrl, snapshot, toDtfRow } from "../chain";
import type { AppEnv, Deps } from "../context";
import { logoOf } from "../logos";
import { assetPrices, assetStats, basketSeries, priceDeltas, recentActivity, withStats } from "../stats";

const unavailable = { status: "unavailable" as const, items: [] };

export function dtfRoutes(app: Hono<AppEnv>, { db, client, logos, demoStats, logsClient }: Deps) {
  app.get("/chains", (c) =>
    c.json({
      items: [
        // Public RPC only — never expose a keyed provider URL from env.
        { chainId: c.get("project").chainId, name: robinhood.name, network: robinhood.testnet ? "testnet" : "mainnet", rpcUrl: publicRpcUrl, explorerUrl },
      ],
    }),
  );

  app.get("/assets", async (c) => {
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const logoMap = (await logos?.(project.chainId, snap.assets.map((a) => a.mint))) ?? new Map<string, string>();
    const usdg = snap.protocol.usdg.toLowerCase();
    // Price (USDG per token) and its 24h / 30d change, so a manager can compare assets.
    const prices = new Map((await assetPrices(client, snap)).map((p) => [p.mint, p]));
    const items = await Promise.all(
      snap.assets.map(async (a) => {
        const id = a.mint.toLowerCase();
        const price = prices.get(id) ?? { priceUsdg: null, priceUpdatedAt: null };
        return {
          id,
          contractAddress: id,
          chainId: project.chainId,
          symbol: a.symbol ?? "?",
          name: a.name ?? a.mint,
          decimals: a.decimals ?? 18,
          underlyingTransferPolicy: "open",
          logoUrl: logoOf(logoMap, id, usdg),
          priceUsdg: price.priceUsdg,
          priceUpdatedAt: price.priceUpdatedAt,
          stats: id === usdg ? null : await assetStats(db, project.id, id, price.priceUsdg, demoStats === true),
        };
      }),
    );
    // Every basket is priced in USDG, so the app needs it even before it's registered as an asset.
    if (!items.some((a) => a.id === usdg)) {
      items.push({ id: usdg, contractAddress: usdg, chainId: project.chainId, symbol: "USDG", name: "Global Dollar", decimals: USDG_DECIMALS, underlyingTransferPolicy: "open", logoUrl: logoOf(logoMap, usdg, usdg), priceUsdg: "1", priceUpdatedAt: null, stats: null });
    }
    return c.json({ items });
  });

  app.get("/dtfs", async (c) => {
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const rows = snap.vaults.map((v) => toDtfRow(v, snap, project.chainId));
    return c.json({ items: await Promise.all(rows.map((r) => withStats(db, project.id, r, demoStats === true))) });
  });

  app.get("/dtfs/:id", async (c) => {
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const v = findVault(snap, c.req.param("id"));
    const row = toDtfRow(v, snap, project.chainId);
    const [items, series, activity] = await Promise.all([
      holdings(client, v, snap),
      basketSeries(db, project.id, row, demoStats === true),
      recentActivity(logsClient ?? client, v.address, project.chainId).catch((e: unknown) => {
        console.error(`recent activity ${v.address}:`, e);
        // Never echo an RPC URL (it can carry an API key).
        return { error: (e instanceof Error ? e.message : String(e)).replace(/https?:\/\/\S+/g, "<rpc>").slice(0, 200) };
      }),
    ]);
    // Until the daily worker has a week of real snapshots, the history is a demo one (flagged) so charts aren't empty.
    const { points, demo } = series;
    const flag = demo ? { demo: true } : {};
    return c.json({
      ...row,
      readModels: {
        holdings: { status: "available", items },
        performance: points.length ? { status: "available", items: points, ...flag } : unavailable,
        performanceDeltas: points.length >= 2 ? { status: "available", items: priceDeltas(points), ...flag } : unavailable,
        recentTransactions: Array.isArray(activity) ? { status: "available", items: activity } : { ...unavailable, reason: activity.error },
        corporateActions: unavailable,
      },
    });
  });
}
