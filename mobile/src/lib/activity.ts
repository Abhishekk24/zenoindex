/**
 * One activity's on-chain details, read from its transaction receipt: the
 * network fee, and what the basket recorded for the wallet (its Deposit,
 * RequestRedeem or Claim event, src/Vault.sol): shares, fees and the USDG
 * that moved. Exact, not estimated from today's fee rates.
 *
 * One receipt read per opened activity. Bounded: each try times out, a
 * failed read is retried with a growing pause (RPC rate limits answer 429),
 * and the whole read gives up after DEADLINE_MS. Mined receipts never
 * change, so they're kept for the session; token symbols too.
 */
import {
  erc20Abi,
  parseAbi,
  parseEventLogs,
  TransactionReceiptNotFoundError,
  type Hex,
} from 'viem';

import { publicClientOf } from './chain';
import type { Dtf, WalletTransaction } from './types';

/** What Portfolio → Activities hands the activity screen (route param). */
export type ActivityLink = {
  tx: WalletTransaction;
  basket: Pick<
    Dtf,
    | 'id'
    | 'name'
    | 'symbol'
    | 'chainId'
    | 'baseAssetId'
    | 'baseAssetDecimals'
    | 'shareDecimals'
  >;
};

const VAULT_EVENTS = parseAbi([
  'event Deposit(address user, uint256 usdcAmount, uint256 netUsdc, uint256 companyFee, uint256 managerFee, uint256 sharesMinted)',
  'event RequestRedeem(address user, uint256 sharesBurned, uint256 pendingUsdcCredited)',
  'event Claim(address user, uint256 grossUsdc, uint256 companyFee, uint256 managerFee, uint256 netUsdc)',
]);

/** Raw integer amounts, as strings (see lib/decimal). */
export type ActivityDetails = {
  /** Mined and not reverted. */
  succeeded: boolean;
  /** Gas used × the price paid for it, in wei. */
  networkFeeRaw: string;
  deposit?: {
    usdcAmount: string;
    netUsdc: string;
    fee: string;
    sharesMinted: string;
  };
  redeemRequest?: { sharesBurned: string; usdcCredited: string };
  claim?: { grossUsdc: string; fee: string; netUsdc: string };
};

const TRY_TIMEOUT_MS = 8_000;
const DEADLINE_MS = 20_000;
const RETRY_PAUSES_MS = [1_000, 3_000];

const receipts = new Map<string, ActivityDetails>();
const symbols = new Map<string, string>();

/** Rejects with `timeout` if `promise` takes longer than `ms`. */
function within<T>(promise: Promise<T>, ms: number): Promise<T> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error('timeout')), ms);
    promise.then(
      value => (clearTimeout(timer), resolve(value)),
      error => (clearTimeout(timer), reject(error)),
    );
  });
}

/** Runs `read` with retries until it answers or the deadline passes. */
async function bounded<T>(read: () => Promise<T>): Promise<T> {
  const deadline = Date.now() + DEADLINE_MS;
  for (let attempt = 0; ; attempt++) {
    try {
      return await within(read(), TRY_TIMEOUT_MS);
    } catch (error) {
      // Not mined yet is an answer, not a failure.
      if (error instanceof TransactionReceiptNotFoundError) throw error;
      const pause = RETRY_PAUSES_MS[attempt];
      if (pause === undefined || Date.now() + pause > deadline) throw error;
      await new Promise(resolve => setTimeout(resolve, pause));
    }
  }
}

/**
 * The activity's details, or null while its transaction isn't mined yet.
 * Throws when the chain couldn't be read in time.
 */
export async function activityDetails(
  chainId: number,
  txHash: string,
  basket: string,
  wallet: string,
): Promise<ActivityDetails | null> {
  const key = `${chainId}:${txHash.toLowerCase()}`;
  const known = receipts.get(key);
  if (known) return known;

  const client = await publicClientOf(chainId);
  let receipt;
  try {
    receipt = await bounded(() =>
      client.getTransactionReceipt({ hash: txHash as Hex }),
    );
  } catch (error) {
    if (error instanceof TransactionReceiptNotFoundError) return null;
    throw error;
  }

  const user = wallet.toLowerCase();
  const logs = parseEventLogs({ abi: VAULT_EVENTS, logs: receipt.logs }).filter(
    log =>
      log.address.toLowerCase() === basket.toLowerCase() &&
      log.args.user.toLowerCase() === user,
  );
  const details: ActivityDetails = {
    succeeded: receipt.status === 'success',
    networkFeeRaw: (receipt.gasUsed * receipt.effectiveGasPrice).toString(),
  };
  for (const log of logs) {
    if (log.eventName === 'Deposit') {
      const a = log.args;
      details.deposit = {
        usdcAmount: a.usdcAmount.toString(),
        netUsdc: a.netUsdc.toString(),
        fee: (a.companyFee + a.managerFee).toString(),
        sharesMinted: a.sharesMinted.toString(),
      };
    } else if (log.eventName === 'RequestRedeem') {
      details.redeemRequest = {
        sharesBurned: log.args.sharesBurned.toString(),
        usdcCredited: log.args.pendingUsdcCredited.toString(),
      };
    } else {
      const a = log.args;
      details.claim = {
        grossUsdc: a.grossUsdc.toString(),
        fee: (a.companyFee + a.managerFee).toString(),
        netUsdc: a.netUsdc.toString(),
      };
    }
  }
  receipts.set(key, details);
  return details;
}

/** An ERC-20's symbol (e.g. "USDG"); kept for the session. */
export async function tokenSymbol(
  chainId: number,
  token: string,
): Promise<string> {
  const key = `${chainId}:${token.toLowerCase()}`;
  const known = symbols.get(key);
  if (known) return known;
  const client = await publicClientOf(chainId);
  const symbol = await bounded(() =>
    client.readContract({
      address: token as Hex,
      abi: erc20Abi,
      functionName: 'symbol',
    }),
  );
  symbols.set(key, symbol);
  return symbol;
}
