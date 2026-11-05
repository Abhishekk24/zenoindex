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
  parseEventLogs,
  type Chain,
  type Hex,
  type PublicClient,
} from 'viem';

import { activeChain } from '../config/chains';
import { listChains, type ChainInfo } from './api';

const chains = new Map<number, Chain>([[activeChain.id, activeChain]]);
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

/** Explorer URL for an address or contract, when the chain publishes one. */
export function explorerAddressUrl(
  chainId: number,
  address: string,
): string | null {
  const base = chains.get(chainId)?.blockExplorers?.default.url;
  return base ? `${base.replace(/\/$/, '')}/address/${address}` : null;
}

/** A chain's display name: 4663 → "Robinhood Chain". */
export function chainName(chainId: number): string {
  return chains.get(chainId)?.name ?? `Chain ${chainId}`;
}

/** The chain's gas token symbol, e.g. "ETH". */
export function nativeSymbol(chainId: number): string {
  return chains.get(chainId)?.nativeCurrency.symbol ?? 'ETH';
}

/** Native (gas token) balance in wei. */
export async function nativeBalance(
  chainId: number,
  owner: string,
): Promise<bigint> {
  return (await publicClientOf(chainId)).getBalance({
    address: owner as Hex,
  });
}

/** Estimated network fee in wei for `gas` units at the current gas price. */
export async function estimateNetworkFee(
  chainId: number,
  gas: bigint,
): Promise<bigint> {
  return gas * (await (await publicClientOf(chainId)).getGasPrice());
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
  return (await publicClientOf(chainId)).getBlockNumber({ cacheTime: 0 });
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
 * Recover a lost wallet reply only from a transaction matching the current
 * draft, mined after the block observed before sending it. Earlier redeem
 * legs can emit events for the same user and must not settle the next leg.
 */
export async function findVaultTx(
  chainId: number,
  vault: string,
  user: string,
  fromBlock: bigint,
  expectedData: Hex,
): Promise<string | null> {
  const client = await publicClientOf(chainId);
  const logs = await client.getLogs({
    address: vault as Hex,
    events: VAULT_USER_EVENTS,
    fromBlock: fromBlock + 1n,
  });
  const matches = logs.filter(
    log =>
      (log.args as { user?: string }).user?.toLowerCase() ===
      user.toLowerCase(),
  );
  for (const hash of new Set(matches.map(log => log.transactionHash))) {
    if (!hash) continue;
    const tx = await client.getTransaction({ hash });
    if (
      tx.from.toLowerCase() === user.toLowerCase() &&
      tx.to?.toLowerCase() === vault.toLowerCase() &&
      tx.input.toLowerCase() === expectedData.toLowerCase()
    ) {
      return hash;
    }
  }
  return null;
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

const VAULT_CREATED = parseAbi([
  'event VaultCreated(uint64 indexed vaultId, address indexed clone, address manager)',
]);

/** The basket (vault clone) a confirmed factory createVault transaction made. */
export async function createdVaultOf(
  chainId: number,
  txHash: string,
): Promise<string | undefined> {
  const client = await publicClientOf(chainId);
  const receipt = await client.getTransactionReceipt({ hash: txHash as Hex });
  const [log] = parseEventLogs({
    abi: VAULT_CREATED,
    eventName: 'VaultCreated',
    logs: receipt.logs,
  });
  return log?.args.clone.toLowerCase();
}
