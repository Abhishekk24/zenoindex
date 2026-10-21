/** Loads the Portfolio screen's data for one wallet. */
import * as api from './api';
import { assetMap, symbolOf } from './basket';
import { erc20BalanceOf } from './chain';
import { fromRaw, mul } from './decimal';
import type { Dtf, WalletPortfolio } from './types';

export type Position = WalletPortfolio['positions'][number];

/**
 * BUG-1 fallback: while the API portfolio read model is a stub, derive
 * positions from on-chain share balances for every listed DTF.
 */
async function positionsFromChain(
  wallet: string,
  dtfs: Dtf[],
): Promise<Position[]> {
  const positions = await Promise.all(
    dtfs.map(async dtf => {
      if (!dtf.contractAddress) return null;
      try {
        const shares = await erc20BalanceOf(
          dtf.chainId,
          dtf.contractAddress,
          wallet,
        );
        if (shares === 0n) return null;
        const sharesText = shares.toString();
        return {
          dtfId: dtf.id,
          shares: sharesText,
          value: mul(fromRaw(sharesText, dtf.shareDecimals), dtf.sharePrice),
          asOf: new Date().toISOString(),
        };
      } catch {
        return null;
      }
    }),
  );
  return positions.filter(p => p !== null);
}

/** Uninvested base asset (the baskets' stablecoin) in the wallet, read on-chain. */
export type Cash = { amount: string; symbol: string };

async function cashOf(wallet: string, dtfs: Dtf[]): Promise<Cash | null> {
  const dtf = dtfs[0];
  if (!dtf?.baseAssetId) return null;
  try {
    const [raw, assets] = await Promise.all([
      erc20BalanceOf(dtf.chainId, dtf.baseAssetId, wallet),
      api.listAssets(),
    ]);
    return {
      amount: fromRaw(raw.toString(), dtf.baseAssetDecimals),
      symbol: symbolOf(dtf.baseAssetId, assetMap(assets)),
    };
  } catch {
    return null;
  }
}

/** Positions, cost basis, activity and cash, plus the baskets keyed by id. */
export async function loadPortfolio(wallet: string) {
  const [view, dtfs] = await Promise.all([
    api.getPortfolio(wallet, list => positionsFromChain(wallet, list)),
    api.listDtfs(),
  ]);
  const cash = await cashOf(wallet, dtfs);
  return { ...view, cash, dtfs: new Map(dtfs.map(d => [d.id, d])) };
}

/** A position's shares as a plain number (for charts and estimates only). */
function sharesOf(p: Position, dtf: Dtf | undefined): number {
  return Number(fromRaw(p.shares, dtf?.shareDecimals ?? 18));
}

/**
 * The value of the current holdings over each basket's last-30-days line
 * (Dtf.stats.sparkline, share prices), oldest first. Aligned on the most
 * recent points; empty when no held basket has a line yet. Chart only.
 */
export function holdingsTrend(
  positions: Position[],
  dtfs: Map<string, Dtf>,
): number[] {
  const lines = positions
    .map(p => {
      const dtf = dtfs.get(p.dtfId);
      return { shares: sharesOf(p, dtf), prices: dtf?.stats?.sparkline ?? [] };
    })
    .filter(l => l.prices.length > 1);
  if (lines.length === 0) return [];
  const length = Math.min(...lines.map(l => l.prices.length));
  return Array.from({ length }, (_, i) =>
    lines.reduce(
      (total, l) => total + l.shares * l.prices[l.prices.length - length + i]!,
      0,
    ),
  );
}

/**
 * Today's change in the holdings' value, from each basket's 24h change
 * (Dtf.stats.change24hBps). Null when no held basket reports one.
 */
export function holdingsToday(
  positions: Position[],
  dtfs: Map<string, Dtf>,
): { amount: number; bps: number } | null {
  let amount = 0;
  let value = 0;
  let known = false;
  for (const p of positions) {
    const bps = dtfs.get(p.dtfId)?.stats?.change24hBps;
    const now = Number(p.value);
    value += now;
    if (bps === null || bps === undefined) continue;
    known = true;
    const rate = bps / 10_000;
    amount += now - now / (1 + rate);
  }
  if (!known || value - amount <= 0) return null;
  return { amount, bps: Math.round((amount / (value - amount)) * 10_000) };
}
