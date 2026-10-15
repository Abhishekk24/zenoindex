// Token logos from Robinhood's public asset list (the same source programmable-dtf-infra uses): every Robinhood Chain
// stock token, keyed by contract address. Logos are cosmetic, so a slow or failed fetch never holds up a response.

const ASSETS_URL = "https://api.robinhood.com/rhj/assets";
const TTL_MS = 6 * 60 * 60 * 1000;
const WAIT_MS = 2000;

/** Lowercase token address → logo URL, for one chain. */
export type LogoSource = (chainId: number) => Promise<Map<string, string>>;

type RobinhoodAssets = { assets?: { logoUrl?: string; deployments?: { contractAddress?: string; chainId?: number }[] }[] };

/** Cached for TTL_MS; a failed refresh keeps the last good map. Waits at most WAIT_MS, then answers with what it has. */
export function robinhoodLogos(fetchFn: typeof fetch = fetch): LogoSource {
  let cached: { at: number; byChain: Map<number, Map<string, string>> } | null = null;
  let refreshing: Promise<void> | null = null;

  const refresh = async () => {
    const res = await fetchFn(ASSETS_URL, { signal: AbortSignal.timeout(10_000) });
    if (!res.ok) throw new Error(`Robinhood assets ${res.status}`);
    const body = (await res.json()) as RobinhoodAssets;
    const byChain = new Map<number, Map<string, string>>();
    for (const asset of body.assets ?? []) {
      if (!asset.logoUrl?.startsWith("https://")) continue;
      for (const d of asset.deployments ?? []) {
        if (!d.contractAddress || d.chainId === undefined) continue;
        if (!byChain.has(d.chainId)) byChain.set(d.chainId, new Map());
        byChain.get(d.chainId)!.set(d.contractAddress.toLowerCase(), asset.logoUrl);
      }
    }
    cached = { at: Date.now(), byChain };
  };

  return async (chainId) => {
    if (!cached || Date.now() - cached.at > TTL_MS) {
      refreshing ??= refresh()
        .catch((e) => console.warn(`logos: ${e instanceof Error ? e.message : e}`))
        .finally(() => (refreshing = null));
      await Promise.race([refreshing, new Promise((r) => setTimeout(r, WAIT_MS))]);
    }
    return cached?.byChain.get(chainId) ?? new Map();
  };
}
