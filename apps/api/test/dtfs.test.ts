import { MAINNET } from "@zenoindex/sdk";
import { describe, expect, it } from "vitest";
import { toDtfRow, type Snapshot } from "../src/chain";
import { mainnetClient, makeApp, seedProject, testDb } from "./helpers";

const vault = "0xAAaaAAaAaaAaAaaAAAAaaaAaAaaAaAaaaAAaAaaA" as const;
const asset = "0xBbBBBbbBBbBBBBbbbbBbbbbbBBbbBBbBbbBbBbBb" as const;

const snap = (over: Partial<Snapshot["vaults"][number]> = {}): Snapshot => ({
  protocol: { factory: MAINNET.factory, usdg: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", router: asset, isEmergency: false, totalVaults: 1n, totalAssets: 2n, maxPriceAge: 86400n, maxSwapSlippageBps: 300, treasury: asset },
  assets: [
    { assetId: 0n, mint: "0x5fc5360D0400a0Fd4f2af552ADD042D716F1d168", active: true, exists: true, symbol: "USDG", name: "Global Dollar", decimals: 6 },
    { assetId: 1n, mint: asset, active: true, exists: true, symbol: "TSLA", name: "Tesla", decimals: 18 },
  ],
  vaults: [
    {
      address: vault, vaultId: 0n, name: "Tech Index", symbol: "TECH", sharesToken: asset, manager: asset, feeRecipient: asset,
      fundType: "dynamic", depositFeeBps: 100, redeemFeeBps: 50, maxShares: 10n ** 18n, paused: false, adminLocked: false,
      genesisDone: true, totalShares: 2_000_000n, totalPendingUsdc: 0n, totalNav: 3_000_000n, sharePrice: 1_500_000n,
      slots: [{ index: 0, assetId: 0n, allocationBps: 2000 }, { index: 1, assetId: 1n, allocationBps: 8000 }],
      ...over,
    },
  ],
});

describe("toDtfRow (the shape zenoIndex-mobile-app's toDtf reads)", () => {
  it("maps a live vault", () => {
    const s = snap();
    const row = toDtfRow(s.vaults[0]!, s, 4663);
    expect(row).toMatchObject({
      id: vault.toLowerCase(),
      chainId: 4663,
      name: "Tech Index",
      symbol: "TECH",
      contractAddress: asset.toLowerCase(),
      baseAssetId: MAINNET.usdg,
      baseAssetDecimals: 6,
      shareDecimals: 6,
      weights: [{ assetId: MAINNET.usdg, weightBps: 2000 }, { assetId: asset.toLowerCase(), weightBps: 8000 }],
      nav: "3",
      sharePrice: "1.5",
      aum: "3",
      fees: { entryBps: 100, exitBps: 50, managementBps: 0 },
      lifecycle: "active",
      totalSupplyRaw: "2000000",
    });
    // money fields must match the app's decimal regex
    for (const k of ["sharePrice", "aum", "nav"] as const) expect(row[k]).toMatch(/^-?\d+(\.\d+)?$/);
  });

  it("is not tradable when paused, before genesis, or when NAV can't be read", () => {
    for (const over of [{ paused: true }, { genesisDone: false }, { totalNav: null, sharePrice: null }]) {
      const s = snap(over);
      const row = toDtfRow(s.vaults[0]!, s, 4663);
      expect(row.lifecycle).toBe("coming_soon");
      expect(row.sharePrice).toMatch(/^\d/);
    }
  });
});

describe.skipIf(!process.env.ZENO_LIVE)("read endpoints against mainnet (read-only)", () => {
  it("serves chains, assets (always incl. USDG) and dtfs", async () => {
    const db = await testDb();
    const { pk } = await seedProject(db);
    const { call } = makeApp(db, mainnetClient());

    const chains = await call("/chains", { key: pk });
    expect(chains.json.items).toEqual([expect.objectContaining({ chainId: 4663, rpcUrl: "https://rpc.mainnet.chain.robinhood.com" })]);

    const assets = await call("/assets", { key: pk });
    expect(assets.json.items.some((a: { id: string }) => a.id === MAINNET.usdg)).toBe(true);

    const dtfs = await call("/dtfs", { key: pk });
    expect(dtfs.status).toBe(200);
    expect(Array.isArray(dtfs.json.items)).toBe(true);

    expect((await call(`/dtfs/${vault}`, { key: pk })).status).toBe(404);
    expect((await call("/compliance/kyc/0xabc/status", { key: pk })).json.status).toBe("not_started");
  }, 30_000);
});
