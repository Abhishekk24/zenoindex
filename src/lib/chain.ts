/**
 * Read-side chain access: the wallet signs and broadcasts, but receipts and
 * balances are read directly from the chain's RPC. Chain metadata (RPC,
 * explorer) comes from the API's /chains, with the bundled Robinhood mainnet
 * definition as fallback.
 */
import {
  createPublicClient,
  defineChain,
  erc20Abi,
  http,
  parseAbi,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem';

import { robinhood } from '../config/chains';
import { listChains, type ChainInfo } from './api';

const chains = new Map<number, Chain>([[robinhood.id, robinhood]]);
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

/** Latest block number, read before a send so the chain can be watched from there. */
export async function blockNumber(chainId: number): Promise<bigint> {
  return (await publicClientOf(chainId)).getBlockNumber();
}

/** Vault events that name the wallet they were sent for (src/Vault.sol). */
const VAULT_USER_EVENTS = parseAbi([
  'event Deposit(address user, uint256 usdcAmount, uint256 netUsdc, uint256 companyFee, uint256 managerFee, uint256 sharesMinted)',
  'event RequestRedeem(address user, uint256 sharesBurned, uint256 pendingUsdcCredited)',
  'event SwapAssetToUsdc(address user, uint8 assetIndex, uint256 assetIn, uint256 usdcOut)',
  'event Claim(address user, uint256 grossUsdc, uint256 companyFee, uint256 managerFee, uint256 netUsdc)',
  'event RedeemSettledInKind(address user, address caller, uint256 usdcPaid)',
]);

/**
 * The hash of the first transaction since `fromBlock` in which `vault`
 * emitted an event for `user`, or null. Used when the wallet's reply is lost
 * but the transaction itself went through.
 */
export async function findVaultTx(
  chainId: number,
  vault: string,
  user: string,
  fromBlock: bigint,
): Promise<string | null> {
  const client = await publicClientOf(chainId);
  const logs = await client.getLogs({
    address: vault as Hex,
    events: VAULT_USER_EVENTS,
    fromBlock,
  });
  const match = logs.find(
    log =>
      (log.args as { user?: string }).user?.toLowerCase() ===
      user.toLowerCase(),
  );
  return match?.transactionHash ?? null;
}

/**
 * Calls `check` every `intervalMs` until it returns a value. Throws `timeout`
 * after `timeoutMs`; stops quietly (never settles) once `signal` aborts.
 */
export function pollUntil<T>(
  check: () => Promise<T | null>,
  opts: {
    signal: AbortSignal;
    timeoutMs: number;
    timeout: string;
    intervalMs?: number;
  },
): Promise<T> {
  const { signal, timeoutMs, timeout, intervalMs = 3_000 } = opts;
  const deadline = Date.now() + timeoutMs;
  return new Promise((resolve, reject) => {
    const tick = async () => {
      if (signal.aborted) return;
      try {
        const value = await check();
        if (signal.aborted) return;
        if (value !== null) return resolve(value);
      } catch {
        // RPC hiccup: try again on the next tick.
      }
      if (Date.now() > deadline) return reject(new Error(timeout));
      setTimeout(tick, intervalMs);
    };
    setTimeout(tick, intervalMs);
  });
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
