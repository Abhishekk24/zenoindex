/**
 * TEMPORARY development sample data, ported from programmable-dtf-infra
 * apps/dtf-app/lib/data.ts so every screen can be walked before the app is
 * connected to the web app's /api/v1. Everything here is invented.
 * Only lib/api.ts reads this file; to remove it, delete it and the sample
 * branches in api.ts.
 */
import { div, mul, mulBps, sub } from './decimal';
import type {
  Asset,
  CorporateAction,
  Dtf,
  DtfDetail,
  DtfHolding,
  DtfTransaction,
  Eligibility,
  NavHistoryPoint,
  PerformanceDelta,
  Session,
  TradePreview,
  TxDraft,
  User,
  WalletPortfolio,
  WalletTransaction,
} from './types';

const AS_OF = '2026-09-29T00:00:00Z';
const DAY_MS = 86_400_000;
const CHAIN_ID = 31337;
const MANAGER = '0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266';
const OTHER_INVESTOR = '0x70997970C51812dc3A010C7d01b50e0d17dc79C8';

/** The sample investor wallet: Portfolio shows its positions. */
export const SAMPLE_WALLET = '0xcfcf6c991364bf93490aa05b1533034a05983558';

// Assets ---------------------------------------------------------------------

function asset(
  index: number,
  symbol: string,
  name: string,
  extra: Partial<Asset> = {},
): Asset {
  return {
    id: `sample-${symbol.toLowerCase()}`,
    symbol,
    name,
    chainId: CHAIN_ID,
    contractAddress: `0x${(0x1000 + index).toString(16).padStart(40, '0')}`,
    decimals: 18,
    oracleStatus: 'accepted',
    tradable: true,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
    ...extra,
  };
}

export const SAMPLE_ASSETS: Asset[] = [
  asset(1, 'USDG', 'Global Dollar', { mode: 'zap', decimals: 6 }),
  asset(2, 'RUSD', 'Restricted Dollar', {
    mode: 'zap',
    decimals: 6,
    underlyingTransferPolicy: 'issuer_allowlist',
  }),
  asset(3, 'WETH', 'Wrapped Ether'),
  asset(4, 'TSLA', 'Tesla · Robinhood Token'),
  asset(5, 'AMZN', 'Amazon · Robinhood Token'),
  asset(6, 'AAPL', 'Apple · Robinhood Token'),
  asset(7, 'MSFT', 'Microsoft · Robinhood Token'),
  asset(8, 'NVDA', 'NVIDIA · Robinhood Token'),
  asset(9, 'GOOGL', 'Alphabet · Robinhood Token'),
  asset(10, 'META', 'Meta Platforms · Robinhood Token'),
];

// Baskets --------------------------------------------------------------------

function dtf(
  id: string,
  name: string,
  symbol: string,
  weights: [assetId: string, weightBps: number][],
  extra: Partial<Dtf> = {},
): Dtf {
  return {
    id,
    chainId: CHAIN_ID,
    name,
    symbol,
    manager: MANAGER,
    contractAddress: `0x${id.replace(/\D/g, '').padStart(40, 'b')}`,
    baseAssetId: 'sample-usdg',
    baseAssetDecimals: 6,
    shareDecimals: 18,
    weights: weights.map(([assetId, weightBps]) => ({ assetId, weightBps })),
    nav: '1.000000',
    sharePrice: '1.000000',
    aum: '20000.000000',
    fees: { entryBps: 0, exitBps: 0, managementBps: 0 },
    minInvestment: '10',
    asOf: AS_OF,
    ...extra,
  };
}

export const SAMPLE_DTFS: Dtf[] = [
  dtf('sample-1', 'Robinhood WETH Integration', 'rWNV', [
    ['sample-weth', 5000],
    ['sample-tsla', 3000],
    ['sample-amzn', 2000],
  ]),
  dtf(
    'sample-2',
    'Magnificent 5',
    'rMAG5',
    [
      ['sample-aapl', 2000],
      ['sample-msft', 2000],
      ['sample-nvda', 2000],
      ['sample-googl', 2000],
      ['sample-amzn', 2000],
    ],
    {
      nav: '1.042100',
      sharePrice: '1.042100',
      aum: '1250000.500000',
      fees: { entryBps: 0, exitBps: 0, managementBps: 50 },
    },
  ),
  dtf('sample-3', 'Treasury Reserve Basket', 'rTRB', [['sample-tsla', 10000]], {
    baseAssetId: 'sample-rusd',
    manager: 'Zeno Capital Management Ltd',
  }),
  dtf(
    'sample-4',
    'AI Infrastructure',
    'rAII',
    [
      ['sample-nvda', 4000],
      ['sample-msft', 3000],
      ['sample-googl', 2000],
      ['sample-meta', 1000],
    ],
    {
      nav: '0.987300',
      sharePrice: '0.987300',
      aum: '482310.250000',
      fees: { entryBps: 10, exitBps: 10, managementBps: 75 },
      strategy: { type: 'market-cap-weighted', driftThresholdBps: 500 },
    },
  ),
  dtf(
    'sample-5',
    'Consumer Tech Duo',
    'rCTD',
    [
      ['sample-aapl', 6000],
      ['sample-amzn', 4000],
    ],
    {
      aum: '73500.000000',
      fees: { entryBps: 0, exitBps: 0, managementBps: 25 },
    },
  ),
  dtf(
    'sample-6',
    'Semiconductor Leaders',
    'rSEMI',
    [
      ['sample-nvda', 6000],
      ['sample-aapl', 4000],
    ],
    { isPublished: false },
  ),
];

// Basket detail: history, holdings, activity ----------------------------------

const SUPPLY: Record<string, string> = {
  'sample-1': '20000',
  'sample-2': '1199500',
  'sample-3': '20000',
  'sample-4': '488510',
  'sample-5': '73500',
  'sample-6': '20000',
};

// Sample generation works in integer millionths, so no float touches a price.
function toMicros(decimal: string): number {
  const [whole = '0', fraction = ''] = decimal.split('.');
  return (
    Number(whole) * 1_000_000 + Number(fraction.padEnd(6, '0').slice(0, 6))
  );
}

function fromMicros(micros: number): string {
  const text = String(micros).padStart(7, '0');
  return `${text.slice(0, -6)}.${text.slice(-6)}`;
}

function daysFromAsOf(days: number): string {
  return new Date(Date.parse(AS_OF) + days * DAY_MS).toISOString();
}

/** 30 daily points drifting from 1.000000 to the basket's current share price. */
function history(item: Dtf): NavHistoryPoint[] {
  const start = 1_000_000;
  const end = toMicros(item.sharePrice);
  const supplyRaw = `${SUPPLY[item.id] ?? '0'}${'0'.repeat(
    item.shareDecimals,
  )}`;
  return Array.from({ length: 30 }, (_, index) => {
    const trend = start + Math.round(((end - start) * index) / 29);
    const wiggle =
      index === 0 || index === 29 ? 0 : (((index * 37) % 11) - 5) * 900;
    const point = fromMicros(trend + wiggle);
    return {
      observedAt: daysFromAsOf(index - 29),
      navValue: point,
      sharePrice: point,
      totalSupplyRaw: supplyRaw,
      valuationStatus: 'accepted',
    };
  });
}

function deltas(points: NavHistoryPoint[]): PerformanceDelta[] {
  const first = points[0];
  const prior = points[points.length - 2];
  const last = points[points.length - 1];
  if (!first || !prior || !last) return [];
  const delta = (from: NavHistoryPoint, window: PerformanceDelta['window']) => {
    const change = toMicros(last.sharePrice) - toMicros(from.sharePrice);
    return {
      window,
      fromObservedAt: from.observedAt,
      toObservedAt: last.observedAt,
      sharePriceDelta: `${change < 0 ? '-' : ''}${fromMicros(
        Math.abs(change),
      )}`,
      sharePriceDeltaBps: Math.round(
        (change * 10_000) / toMicros(from.sharePrice),
      ),
    };
  };
  return [delta(prior, 'latest'), delta(first, 'inception')];
}

function holdings(item: Dtf): DtfHolding[] {
  // Offsetting ±0.35% drift so actual weights differ slightly from targets.
  const count = item.weights.length;
  return item.weights.map((weight, index) => {
    const isLastOfOdd = index === count - 1 && count % 2 === 1;
    const drift = count === 1 || isLastOfOdd ? 0 : index % 2 === 0 ? 35 : -35;
    return {
      assetId: weight.assetId,
      quantityRaw: `${weight.weightBps * 7 + 113}${'0'.repeat(16)}`,
      targetWeightBps: weight.weightBps,
      actualWeightBps: weight.weightBps + drift,
      valuationStatus: 'accepted',
      asOf: AS_OF,
    };
  });
}

// What SAMPLE_WALLET invested in each basket, in whole base-asset units.
const WALLET_BUYS: Record<string, string> = {
  'sample-1': '4800',
  'sample-2': '1200',
  'sample-4': '850',
};

function transactions(item: Dtf): DtfTransaction[] {
  const raw = (whole: string, decimals: number) =>
    `${whole}${'0'.repeat(decimals)}`;
  const tx = (
    n: number,
    action: string,
    wallet: string,
    amount: string | null,
    shares: string | null,
    days: number,
  ): DtfTransaction => ({
    id: `${item.id}-tx-${n}`,
    chainId: item.chainId,
    txHash: `0x${(0xa1b2c3 * (n + 1) + item.id.length)
      .toString(16)
      .padStart(64, '0')}`,
    action,
    walletAddress: wallet,
    assetId: item.baseAssetId,
    amountRaw: amount === null ? null : raw(amount, item.baseAssetDecimals),
    shareAmountRaw: shares === null ? null : raw(shares, item.shareDecimals),
    status: 'confirmed',
    occurredAt: daysFromAsOf(-days),
  });
  const walletBuy = WALLET_BUYS[item.id];
  return [
    tx(5, 'redeem', OTHER_INVESTOR, '1000', '990', 2),
    tx(4, 'invest', OTHER_INVESTOR, '2500', '2480', 6),
    tx(3, 'rebalance', MANAGER, null, null, 14),
    ...(walletBuy
      ? [tx(2, 'invest', SAMPLE_WALLET, walletBuy, walletBuy, 21)]
      : []),
    tx(1, 'invest', OTHER_INVESTOR, '15000', '15000', 27),
    tx(0, 'create', MANAGER, null, null, 29),
  ];
}

const CORPORATE_EVENTS: Omit<CorporateAction, 'id'>[] = [
  {
    assetId: 'sample-aapl',
    actionType: 'cash dividend',
    effectiveAt: daysFromAsOf(12),
    status: 'announced',
    payload: { perShare: '0.25', currency: 'USD', policy: 'reinvest' },
  },
  {
    assetId: 'sample-msft',
    actionType: 'cash dividend',
    effectiveAt: daysFromAsOf(-18),
    status: 'effective',
    payload: { perShare: '0.83', currency: 'USD', policy: 'reinvest' },
  },
  {
    assetId: 'sample-nvda',
    actionType: 'stock split',
    effectiveAt: daysFromAsOf(-40),
    status: 'effective',
    payload: { ratio: '10:1' },
  },
  {
    assetId: 'sample-tsla',
    actionType: 'rights issue',
    effectiveAt: daysFromAsOf(-9),
    status: 'cancelled',
    payload: { note: 'Withdrawn by issuer' },
  },
  {
    assetId: 'sample-amzn',
    actionType: 'cash dividend',
    effectiveAt: daysFromAsOf(26),
    status: 'announced',
    payload: { perShare: '0.10', currency: 'USD', policy: 'distribute' },
  },
];

function corporateActions(item: Dtf): CorporateAction[] {
  const held = new Set(item.weights.map(w => w.assetId));
  return CORPORATE_EVENTS.filter(event => held.has(event.assetId))
    .map((event, index) => ({ id: `${item.id}-ca-${index}`, ...event }))
    .sort((a, b) => Date.parse(b.effectiveAt) - Date.parse(a.effectiveAt));
}

export function sampleDtfDetail(id: string): DtfDetail | null {
  const item = SAMPLE_DTFS.find(entry => entry.id === id);
  if (!item) return null;
  const points = history(item);
  return {
    ...item,
    valuationStatus: 'accepted',
    totalSupplyRaw: `${SUPPLY[id] ?? '0'}${'0'.repeat(item.shareDecimals)}`,
    holdings: holdings(item),
    performance: points,
    performanceDeltas: deltas(points),
    recentTransactions: transactions(item),
    corporateActions: corporateActions(item),
  };
}

// Portfolio -------------------------------------------------------------------

/** SAMPLE_WALLET's positions; values are in base-asset units. */
export const SAMPLE_PORTFOLIO: WalletPortfolio = {
  wallet: SAMPLE_WALLET,
  positions: [
    {
      dtfId: 'sample-1',
      shares: `4800${'0'.repeat(18)}`,
      value: '4800.00',
      asOf: AS_OF,
    },
    {
      dtfId: 'sample-2',
      shares: `1200${'0'.repeat(18)}`,
      value: '1250.52',
      asOf: AS_OF,
    },
    {
      dtfId: 'sample-4',
      shares: `850${'0'.repeat(18)}`,
      value: '839.21',
      asOf: AS_OF,
    },
  ],
};

/** What the sample wallet paid into each basket (the cost basis). */
export const SAMPLE_COST_BASIS: Record<string, string> = WALLET_BUYS;

/** The sample wallet's own transactions across every basket, newest first. */
export function sampleWalletActivity(): WalletTransaction[] {
  return SAMPLE_DTFS.flatMap(item =>
    transactions(item).map(tx => ({ ...tx, dtfId: item.id })),
  )
    .filter(tx => tx.walletAddress === SAMPLE_WALLET)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

// Invest / redeem preview -----------------------------------------------------

function sampleDraft(action: string, dtfId: string, data: unknown): TxDraft {
  return {
    action,
    requestId: `sample-${action}-${dtfId}`,
    transaction: {
      to: '0x5FbDB2315678afecb367f032d93F642f64180aa3',
      data: `0x8c1a5f2e${dtfId.replace(/\D/g, '').padStart(64, '0')}`,
      value: '0',
      chainId: CHAIN_ID,
      gas: '310000',
    },
    data,
  };
}

/**
 * A stand-in for the API's quote. The real preview comes from the core API's
 * prepare endpoints; this only gives the panel plausible numbers.
 */
export function samplePreview(
  item: Dtf,
  side: TradePreview['side'],
  amount: string,
): TradePreview {
  if (side === 'invest') {
    const fee = mulBps(amount, item.fees.entryBps);
    const shares = div(sub(amount, fee), item.sharePrice);
    return {
      side,
      pay: amount,
      receive: shares,
      feeBps: item.fees.entryBps,
      fee,
      quotedSharePrice: item.sharePrice,
      draft: sampleDraft('invest', item.id, { amount }),
    };
  }
  const gross = mul(amount, item.sharePrice);
  const fee = mulBps(gross, item.fees.exitBps);
  return {
    side,
    pay: amount,
    receive: sub(gross, fee),
    feeBps: item.fees.exitBps,
    fee,
    quotedSharePrice: item.sharePrice,
    draft: sampleDraft('redeem', item.id, { shares: amount }),
  };
}

// Account ----------------------------------------------------------------------

export function sampleUser(email = 'investor@zeno.example'): User {
  return {
    id: 'sample-investor',
    email,
    displayName: 'Sample Investor',
    firstName: 'Sample',
    lastName: 'Investor',
    country: 'GB',
    wallets: [{ address: SAMPLE_WALLET, chainId: CHAIN_ID, primary: true }],
    twoFactorEnabled: false,
    termsAcceptedAt: AS_OF,
    profileCompletedAt: AS_OF,
    createdAt: AS_OF,
  };
}

/** A just-registered account: terms and profile still to do, no wallet. */
export function sampleNewUser(email: string): User {
  return {
    ...sampleUser(email),
    id: 'sample-new',
    displayName: null,
    firstName: null,
    lastName: null,
    country: null,
    wallets: [],
    termsAcceptedAt: null,
    profileCompletedAt: null,
  };
}

export const SAMPLE_ELIGIBILITY: Eligibility = {
  kycStatus: 'not_started',
  provider: 'Didit',
  verifiedAt: null,
  permissionedAccess: false,
};

export const SAMPLE_SESSIONS: Session[] = [
  {
    id: 's1',
    device: 'Zeno on iPhone',
    lastActive: '2026-10-05T09:12:40Z',
    current: true,
  },
  {
    id: 's2',
    device: 'Chrome on macOS',
    lastActive: '2026-10-03T23:49:04Z',
    current: false,
  },
  {
    id: 's3',
    device: 'Chrome on Android',
    lastActive: '2026-09-28T14:07:24Z',
    current: false,
  },
];
