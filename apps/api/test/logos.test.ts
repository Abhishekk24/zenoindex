import { describe, expect, it } from "vitest";
import { robinhoodLogos } from "../src/logos";

const body = {
  assets: [
    {
      logoUrl: "https://cdn.robinhood.com/ncw_assets/logos/0xabc.png",
      deployments: [
        { contractAddress: "0xABC", chainId: 4663 },
        { contractAddress: "0xDEF", chainId: 46630 },
      ],
    },
    { logoUrl: "http://insecure.example/logo.png", deployments: [{ contractAddress: "0x123", chainId: 4663 }] },
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
  it("maps each chain's token addresses (lowercase) to https logos only", async () => {
    const logos = robinhoodLogos(fakeFetch([ok]).fn);
    expect([...(await logos(4663))]).toEqual([["0xabc", "https://cdn.robinhood.com/ncw_assets/logos/0xabc.png"]]);
    expect([...(await logos(46630)).keys()]).toEqual(["0xdef"]);
  });

  it("fetches once and serves the cache after that", async () => {
    const f = fakeFetch([ok]);
    const logos = robinhoodLogos(f.fn);
    await logos(4663);
    await logos(4663);
    expect(f.calls()).toBe(1);
  });

  it("a failed fetch answers with no logos instead of failing the request", async () => {
    const logos = robinhoodLogos(fakeFetch([() => new Response("down", { status: 503 })]).fn);
    expect((await logos(4663)).size).toBe(0);
  });
});
