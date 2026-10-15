import { robinhood, USDG_DECIMALS } from "@zenoindex/sdk";
import type { Hono } from "hono";
import { explorerUrl, findVault, holdings, publicRpcUrl, snapshot, toDtfRow } from "../chain";
import type { AppEnv, Deps } from "../context";
import { logoOf } from "../logos";
import { demoHistory, MIN_REAL_POINTS, navHistory, priceDeltas, recentActivity } from "../stats";

const unavailable = { status: "unavailable" as const, items: [] };

export function dtfRoutes(app: Hono<AppEnv>, { db, client, logos, demoStats, logsClient }: Deps) {
  app.get("/chains", (c) =>
    c.json({
      items: [
        // Public RPC only — never expose a keyed provider URL from env.
        { chainId: c.get("project").chainId, name: robinhood.name, network: "mainnet", rpcUrl: publicRpcUrl, explorerUrl },
      ],
    }),
  );

  app.get("/assets", async (c) => {
    const project = c.get("project");
    const [snap, logoMap] = await Promise.all([snapshot(client, project.factory), logos?.(project.chainId) ?? new Map<string, string>()]);
    const usdg = snap.protocol.usdg.toLowerCase();
    const items = snap.assets.map((a) => ({
      id: a.mint.toLowerCase(),
      contractAddress: a.mint.toLowerCase(),
      chainId: project.chainId,
      symbol: a.symbol ?? "?",
      name: a.name ?? a.mint,
      decimals: a.decimals ?? 18,
      underlyingTransferPolicy: "open",
      logoUrl: logoOf(logoMap, a.mint.toLowerCase(), usdg),
    }));
    // Every basket is priced in USDG, so the app needs it even before it's registered as an asset.
    if (!items.some((a) => a.id === usdg)) {
      items.push({ id: usdg, contractAddress: usdg, chainId: project.chainId, symbol: "USDG", name: "Global Dollar", decimals: USDG_DECIMALS, underlyingTransferPolicy: "open", logoUrl: logoOf(logoMap, usdg, usdg) });
    }
    return c.json({ items });
  });

  app.get("/dtfs", async (c) => {
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    return c.json({ items: snap.vaults.map((v) => toDtfRow(v, snap, project.chainId)) });
  });

  app.get("/dtfs/:id", async (c) => {
    const project = c.get("project");
    const snap = await snapshot(client, project.factory);
    const v = findVault(snap, c.req.param("id"));
    const row = toDtfRow(v, snap, project.chainId);
    const [items, real, activity] = await Promise.all([
      holdings(client, v, snap),
      navHistory(db, project.id, row.id),
      recentActivity(logsClient ?? client, v.address, project.chainId).catch((e: unknown) => {
        console.error(`recent activity ${v.address}:`, e);
        // Never echo an RPC URL (it can carry an API key).
        return { error: (e instanceof Error ? e.message : String(e)).replace(/https?:\/\/\S+/g, "<rpc>").slice(0, 200) };
      }),
    ]);
    // Until the daily worker has a week of real snapshots, show a demo history (flagged) so the charts aren't empty.
    const demo = real.length < MIN_REAL_POINTS && demoStats === true;
    const points = demo ? demoHistory(row.id, { sharePrice: row.sharePrice, nav: row.nav ?? "0", totalSupplyRaw: row.totalSupplyRaw }) : real;
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
