/**
 * SAMPLE DATA for the manager screens (design walkthrough only).
 *
 * The ZenoIndex API has no manager endpoints yet (authored baskets, fee
 * accruals and claims, corporate actions, rebalance prepare, create, liquidity),
 * so every manager screen reads from here. Replace each export with its API
 * call when the endpoint exists; the screens only use these shapes.
 */
import { assetMap, type AssetMap } from '../lib/basket';
import type { Asset, Dtf } from '../lib/types';

const MANAGER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const USDG = '0x0000000000000000000000000000000000000a01';

function asset(
  n: number,
  symbol: string,
  name: string,
  policy: Asset['underlyingTransferPolicy'] = 'open',
): Asset {
  return {
    id: `0x00000000000000000000000000000000000000${n.toString(16).padStart(2, '0')}`,
    symbol,
    name,
    chainId: 4663,
    contractAddress: `0x00000000000000000000000000000000000000${n.toString(16).padStart(2, '0')}`,
    decimals: 18,
    oracleStatus: 'accepted',
    tradable: true,
    mode: 'in-kind',
    underlyingTransferPolicy: policy,
  };
}

const ASSETS: Asset[] = [
  { ...asset(1, 'USDG', 'Global Dollar'), id: USDG, mode: 'zap', decimals: 6 },
  asset(2, 'SPY', 'S&P 500 ETF'),
  asset(3, 'AMZN', 'Amazon'),
  asset(4, 'TSLA', 'Tesla'),
  asset(5, 'NVDA', 'Nvidia'),
  asset(6, 'AAPL', 'Apple'),
  asset(7, 'WETH', 'Wrapped Ether'),
];

export const sampleAssets: AssetMap = assetMap(ASSETS);

const id = (n: number) => ASSETS[n]!.id;

function basket(
  key: string,
  name: string,
  weights: [number, number][],
  extra: Partial<Dtf> = {},
): Dtf {
  return {
    id: key,
    chainId: 4663,
    name,
    symbol: 'rWNV',
    manager: MANAGER,
    contractAddress: '0x5F0000000000000000000000000000000000Aaa3',
    baseAssetId: USDG,
    baseAssetDecimals: 6,
    shareDecimals: 6,
    weights: weights.map(([asset, weightBps]) => ({
      assetId: id(asset),
      weightBps,
    })),
    nav: '20000',
    sharePrice: '1',
    aum: '20000',
    fees: { entryBps: 0, exitBps: 0, managementBps: 0 },
    asOf: '2026-10-14T00:00:00Z',
    lifecycle: 'active',
    ...extra,
  } as Dtf;
}

/** The manager's own ("authored") baskets. */
export const sampleBaskets: Dtf[] = [
  basket('sample-mag5', 'Magnificent 5', [
    [1, 2000],
    [2, 2000],
    [3, 2000],
    [4, 2000],
    [5, 2000],
  ]),
  basket(
    'sample-weth',
    'Robinhood WETH Integration',
    [
      [1, 3400],
      [2, 3300],
      [3, 3300],
    ],
    {
      aum: '4822310.25',
      nav: '4822310.25',
      fees: { entryBps: 0, exitBps: 0, managementBps: 75 },
    },
  ),
  basket('sample-ai', 'AI Infrastructure', [
    [4, 4000],
    [5, 3000],
    [6, 3000],
  ]),
];

export function sampleBasket(key: string | undefined): Dtf | undefined {
  return sampleBaskets.find(b => b.id === key);
}

/** Fee schedule rows exactly as the Fees design shows them. */
export const sampleFeeRows = sampleBaskets.map(b => ({
  id: b.id,
  managementBps: b.fees.managementBps,
  aum: b.aum,
}));

/** "Accrued and claimable" (design). */
export const sampleClaimable = { total: '10930.21', baskets: 6 };

export const sampleAccrual = [
  { label: 'Basis', value: 'Daily on AUM' },
  { label: 'Day count', value: 'Actual' },
  { label: 'Claim cadence', value: 'Manager-initiated' },
  { label: 'Performance fee', value: 'None' },
];

export type CorporateActionStatus = 'announced' | 'effective';

export type SampleCorporateAction = {
  id: string;
  type: string;
  /** e.g. "$0.01/sh"; null when the action has no amount. */
  amount: string | null;
  recordDate: string;
  status: CorporateActionStatus;
};

export const sampleCorporateActions: SampleCorporateAction[] = [
  {
    id: 'ca1',
    type: 'Cash Dividend',
    amount: null,
    recordDate: '2026-10-25',
    status: 'announced',
  },
  {
    id: 'ca2',
    type: 'Cash Dividend',
    amount: null,
    recordDate: '2026-11-11',
    status: 'announced',
  },
  {
    id: 'ca3',
    type: 'Cash Dividend',
    amount: null,
    recordDate: '2026-12-30',
    status: 'effective',
  },
  {
    id: 'ca4',
    type: 'Stock Split',
    amount: null,
    recordDate: '2026-01-11',
    status: 'announced',
  },
];

/** A prepared rebalance transaction (design: Rebalance → Transaction Draft). */
export const sampleRebalanceDraft = {
  to: '0x5F00000000000000000000000000000000000aa3',
  chainId: 31337,
  value: '0',
  requestId: 'mock-rebalance-sample-1',
  calldata:
    '0x8c1a5f2e00000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000001',
};
