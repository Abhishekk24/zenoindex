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
