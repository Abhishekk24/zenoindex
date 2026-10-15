import { robinhood, USDG_DECIMALS } from "@zenoindex/sdk";
import type { Hono } from "hono";
import { explorerUrl, findVault, holdings, publicRpcUrl, snapshot, toDtfRow } from "../chain";
import type { AppEnv, Deps } from "../context";

const unavailable = { status: "unavailable" as const, items: [] };

export function dtfRoutes(app: Hono<AppEnv>, { client, logos }: Deps) {
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
    const [snap, logoOf] = await Promise.all([snapshot(client, project.factory), logos?.(project.chainId) ?? new Map<string, string>()]);
    const items = snap.assets.map((a) => ({
      id: a.mint.toLowerCase(),
      contractAddress: a.mint.toLowerCase(),
      chainId: project.chainId,
      symbol: a.symbol ?? "?",
      name: a.name ?? a.mint,
      decimals: a.decimals ?? 18,
      underlyingTransferPolicy: "open",
      logoUrl: logoOf.get(a.mint.toLowerCase()) ?? null,
    }));
    // Every basket is priced in USDG, so the app needs it even before it's registered as an asset.
    const usdg = snap.protocol.usdg.toLowerCase();
    if (!items.some((a) => a.id === usdg)) {
      items.push({ id: usdg, contractAddress: usdg, chainId: project.chainId, symbol: "USDG", name: "Global Dollar", decimals: USDG_DECIMALS, underlyingTransferPolicy: "open", logoUrl: logoOf.get(usdg) ?? null });
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
    return c.json({
      ...toDtfRow(v, snap, project.chainId),
      readModels: {
        holdings: { status: "available", items: await holdings(client, v, snap) },
        // Need the indexer (Phase 3).
        performance: unavailable,
        performanceDeltas: unavailable,
        recentTransactions: unavailable,
        corporateActions: unavailable,
      },
    });
  });
}
