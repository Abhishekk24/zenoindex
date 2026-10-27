import { describe, expect, it } from "vitest";
import { robinhoodLogos } from "../src/logos";

const body = {
  assets: [
    {
      tokenSymbol: "tsla",
      deployments: [
        { contractAddress: "0xABC", chainId: 4663 },
        { contractAddress: "0xDEF", chainId: 46630 },
      ],
    },
    { tokenSymbol: "not a ticker!", deployments: [{ contractAddress: "0x123", chainId: 4663 }] },
    { deployments: [{ contractAddress: "0x456", chainId: 4663 }] },
  ],
};

function fakeFetch(responses: (() => Response)[]) {
  let calls = 0;
  const fn = (async () => responses[Math.min(calls++, responses.length - 1)]!()) as unknown as typeof fetch;
  return { fn, calls: () => calls };
}
const ok = () => new Response(JSON.stringify(body), { status: 200 });

describe("robinhoodLogos", () => {
  it("maps each chain's token addresses (lowercase) to a logo for the token's ticker", async () => {
    const logos = robinhoodLogos(fakeFetch([ok]).fn);
    expect([...(await logos(4663))]).toEqual([["0xabc", "https://financialmodelingprep.com/image-stock/TSLA.png"]]);
    expect([...(await logos(46630)).keys()]).toEqual(["0xdef"]);
  });

  it("fetches once and serves the cache after that", async () => {
    const f = fakeFetch([ok]);
    const logos = robinhoodLogos(f.fn);
    await logos(4663);
    await logos(4663);
    expect(f.calls()).toBe(1);
  });

  it("fills tokens missing from Robinhood's list from DexScreener, once", async () => {
    const urls: string[] = [];
    const fn = (async (url: string) => {
      urls.push(url);
      if (url.includes("robinhood.com")) return ok();
      return new Response(JSON.stringify([{ baseToken: { address: "0xMEME" }, info: { imageUrl: "https://cdn.dexscreener.com/meme.png" } }]));
    }) as unknown as typeof fetch;
    const logos = robinhoodLogos(fn);
    const map = await logos(4663, ["0xABC", "0xMEME", "0xNONE"]);
    expect(map.get("0xmeme")).toBe("https://cdn.dexscreener.com/meme.png");
    expect(map.get("0xabc")).toBe("https://financialmodelingprep.com/image-stock/TSLA.png");
    expect(map.has("0xnone")).toBe(false);
    expect(urls.filter((u) => u.includes("dexscreener"))).toEqual(["https://api.dexscreener.com/tokens/v1/robinhood/0xmeme,0xnone"]);
    await logos(4663, ["0xMEME", "0xNONE"]);
    expect(urls.filter((u) => u.includes("dexscreener"))).toHaveLength(1);
  });

  it("a failed fetch answers with no logos instead of failing the request", async () => {
    const logos = robinhoodLogos(fakeFetch([() => new Response("down", { status: 503 })]).fn);
    expect((await logos(4663)).size).toBe(0);
  });
});
