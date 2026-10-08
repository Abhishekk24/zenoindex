/**
 * Read-side chain access: the wallet signs and broadcasts, but receipts and
 * balances are read directly from the chain's RPC. Chain metadata (RPC,
 * explorer) comes from the hosted API's /v1/chains, with the bundled
 * Robinhood testnet definition as fallback.
 */
import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem';

import { localChain, robinhoodTestnet } from '../config/chains';
import { listChains, type ChainInfo } from './api';

const chains = new Map<number, Chain>([
  [robinhoodTestnet.id, robinhoodTestnet],
  // Bundled def wins over the API's rpcUrl (typically 127.0.0.1, which only
  // resolves on the dev machine — a phone needs EXPO_PUBLIC_CHAIN_RPC_URL).
  [localChain.id, localChain],
]);
const clients = new Map<number, PublicClient>();
let chainsLoaded: Promise<void> | null = null;

/** Fill the chain registry from /v1/chains once; failures keep fallbacks. */
export async function loadChains(): Promise<void> {
  chainsLoaded ??= (async () => {
    const remote = await listChains().catch(() => [] as ChainInfo[]);
    for (const c of remote) {
      if (!c.chainId || chains.has(c.chainId)) continue;
      if (!c.rpcUrl) continue;
      chains.set(
        c.chainId,
        defineChain({
          id: c.chainId,
          name: c.name ?? `Chain ${c.chainId}`,
          nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
          rpcUrls: { default: { http: [c.rpcUrl] } },
          ...(c.explorerUrl
            ? {
                blockExplorers: {
                  default: { name: 'Explorer', url: c.explorerUrl },
                },
              }
            : {}),
        }),
      );
    }
  })();
  return chainsLoaded;
}

export function chainOf(chainId: number): Chain | undefined {
  return chains.get(chainId);
}

/** Explorer URL for a tx hash, when the chain publishes one. */
export function explorerTxUrl(chainId: number, txHash: string): string | null {
  const base = chains.get(chainId)?.blockExplorers?.default.url;
  return base ? `${base.replace(/\/$/, '')}/tx/${txHash}` : null;
}

export async function publicClientOf(chainId: number): Promise<PublicClient> {
  await loadChains();
  const cached = clients.get(chainId);
  if (cached) return cached;
  const chain = chains.get(chainId);
  if (!chain) throw new Error(`Chain ${chainId} is not supported by this app.`);
  const client = createPublicClient({
    chain,
    transport: http(chain.rpcUrls.default.http[0], { timeout: 30_000 }),
  });
  clients.set(chainId, client);
  return client;
}

/** ERC-20 `balanceOf` — used for the interim portfolio fallback (BUG-1). */
export async function erc20BalanceOf(
  chainId: number,
  token: string,
  owner: string,
): Promise<bigint> {
  const client = await publicClientOf(chainId);
  return (await client.readContract({
    address: token as Hex,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner as Hex],
  })) as bigint;
}

/** ERC-20 `allowance` — the invest draft spends the base asset via transferFrom. */
export async function erc20Allowance(
  chainId: number,
  token: string,
  owner: string,
  spender: string,
): Promise<bigint> {
  const client = await publicClientOf(chainId);
  return (await client.readContract({
    address: token as Hex,
    abi: erc20Abi,
    functionName: 'allowance',
    args: [owner as Hex, spender as Hex],
  })) as bigint;
}

/** Wait for a broadcast transaction's receipt; throws on revert/timeout. */
export async function waitForReceipt(
  chainId: number,
  txHash: string,
  timeoutMs = 120_000,
): Promise<{ status: 'success' | 'reverted' }> {
  const client = await publicClientOf(chainId);
  const receipt = await client.waitForTransactionReceipt({
    hash: txHash as Hex,
    timeout: timeoutMs,
  });
  return { status: receipt.status === 'success' ? 'success' : 'reverted' };
}
