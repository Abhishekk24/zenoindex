import { describe, expect, it } from "vitest";
import { demoHistory, priceDeltas } from "../src/stats";

const vault = "0x1111111111111111111111111111111111111111";
const current = { sharePrice: "1.25", nav: "125", totalSupplyRaw: "100000000" };

describe("demoHistory", () => {
  it("30 daily points ending exactly at the basket's real price and NAV", () => {
    const points = demoHistory(vault, current);
    expect(points).toHaveLength(30);
    expect(points.at(-1)).toMatchObject({ sharePrice: "1.250000", navValue: "125.000000" });
    const days = (Date.parse(points.at(-1)!.observedAt) - Date.parse(points[0]!.observedAt)) / 86_400_000;
    expect(Math.round(days)).toBe(29);
  });

  it("is the same chart on every request (seeded by the vault)", () => {
    const a = demoHistory(vault, current).map((p) => p.sharePrice);
    const b = demoHistory(vault, current).map((p) => p.sharePrice);
    expect(a).toEqual(b);
    expect(demoHistory("0x2222222222222222222222222222222222222222", current).map((p) => p.sharePrice)).not.toEqual(a);
  });

  it("an unseeded basket (price 0) is drawn around 1", () => {
    expect(demoHistory(vault, { sharePrice: "0", nav: "0", totalSupplyRaw: "0" }).at(-1)!.sharePrice).toBe("1.000000");
  });
});

describe("priceDeltas", () => {
  const at = (sharePrice: string, day: number) => ({
    observedAt: new Date(Date.UTC(2026, 9, day)).toISOString(),
    navValue: "0",
    sharePrice,
    totalSupplyRaw: "0",
    valuationStatus: "accepted" as const,
  });

  it("latest = vs the previous point, inception = vs the first", () => {
    expect(priceDeltas([at("1", 1), at("1.1", 2), at("1.21", 3)])).toEqual([
      { window: "latest", fromObservedAt: at("1.1", 2).observedAt, toObservedAt: at("1.21", 3).observedAt, sharePriceDelta: "0.11", sharePriceDeltaBps: 1000 },
      { window: "inception", fromObservedAt: at("1", 1).observedAt, toObservedAt: at("1.21", 3).observedAt, sharePriceDelta: "0.21", sharePriceDeltaBps: 2100 },
    ]);
  });

  it("needs two points", () => {
    expect(priceDeltas([at("1", 1)])).toEqual([]);
  });
});
