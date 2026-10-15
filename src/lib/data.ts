/**
 * MOCK DATA for testing the app without the ZenoIndex API.
 *
 * Turn it on in `.env` and restart Metro (`npx expo start -c`):
 *
 *   EXPO_PUBLIC_USE_MOCK_DATA=true
 *
 * Every API call (lib/http.ts) is then answered from here instead of the
 * server, with the same JSON shapes the API returns, so screens and lib/api.ts
 * run unchanged. Development builds only: release builds ignore the flag.
 *
 * Edit the data below to try other cases (empty lists, coming-soon baskets,
 * pending verification…). A call with no mock answers 404 "mock_missing",
 * naming the path, so gaps are obvious.
 *
 * Not covered: anything read straight from the chain (wallet balances,
 * allowances, receipts in lib/chain.ts) and wallet signing; those still need
 * a real wallet and network.
 */

export const USE_MOCK_DATA =
  __DEV__ && process.env.EXPO_PUBLIC_USE_MOCK_DATA === 'true';

/** Simulated network delay, so loading states show. */
const DELAY_MS = 350;

// ---------------------------------------------------------------------------
// Who is signed in
// ---------------------------------------------------------------------------

/** The signed-in wallet; manager mode lists the baskets this wallet manages. */
export const MOCK_WALLET = '0x3e9a5c2d7f1b4e8a9c6d0f2b3a4e5d6c7b8ab71c';

/** Start signed in (skips sign-in). Set false to test the sign-in screens. */
let signedIn = true;

const user = {
  id: 'user-mock-1',
  email: 'ans.rajan.mishra@gmail.com',
  displayName: 'Anish Mishra',
  firstName: 'Anish',
  lastName: 'Mishra',
  country: 'GB',
  walletAddress: MOCK_WALLET,
  wallets: [{ address: MOCK_WALLET, chainId: 4663, isPrimary: true }],
  twoFactorEnabled: false,
  // Set either to null to land on the Terms step after sign-in.
  termsAcceptedAt: '2026-09-29T10:00:00Z',
  privacyAcceptedAt: '2026-09-29T10:00:00Z',
  createdAt: '2026-09-29T10:00:00Z',
};

// ---------------------------------------------------------------------------
// Assets
// ---------------------------------------------------------------------------

const CHAIN_ID = 4663;
const addr = (n: number) => `0x${n.toString(16).padStart(40, '0')}`;

const USDG = addr(0xa01);
const USTB = addr(0xa02);

const assets = [
  // Base assets ("zap"): what baskets are bought and sold in.
  {
    id: USDG,
    symbol: 'USDG',
    name: 'Global Dollar',
    decimals: 6,
    mode: 'zap',
    underlyingTransferPolicy: 'open',
  },
  // A permissioned base asset makes its baskets "Permissioned".
  {
    id: USTB,
    symbol: 'USTB',
    name: 'Superstate Treasury',
    decimals: 6,
    mode: 'zap',
    underlyingTransferPolicy: 'issuer_allowlist',
  },
  {
    id: addr(0xb01),
    symbol: 'TSLA',
    name: 'Tesla',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb02),
    symbol: 'AMZN',
    name: 'Amazon',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb03),
    symbol: 'NVDA',
    name: 'Nvidia',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb04),
    symbol: 'AAPL',
    name: 'Apple',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb05),
    symbol: 'MSFT',
    name: 'Microsoft',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb06),
    symbol: 'SPY',
    name: 'S&P 500 ETF',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb07),
    symbol: 'WETH',
    name: 'Wrapped Ether',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'open',
  },
  {
    id: addr(0xb08),
    symbol: 'TBILL',
    name: 'US T-Bill 3M',
    decimals: 18,
    mode: 'in-kind',
    underlyingTransferPolicy: 'issuer_allowlist',
  },
].map(a => ({
  ...a,
  chainId: CHAIN_ID,
  contractAddress: a.id,
  oracleStatus: 'accepted',
  tradable: true,
}));

const asset = (symbol: string) => assets.find(a => a.symbol === symbol)!.id;

// ---------------------------------------------------------------------------
// Baskets (DTFs)
// ---------------------------------------------------------------------------

const OTHER_MANAGER = '0x44bcf620e72912aa0f0e8142d4ad67d581793e18';

type MockDtf = {
  id: string;
  name: string;
  symbol: string;
  manager: string;
  baseAssetId: string;
  weights: [string, number][];
  sharePrice: string;
  aum: string;
  fees: { entryBps: number; exitBps: number; managementBps: number };
  strategyType: string;
  /** 'active', or 'coming_soon' (trading disabled). */
  lifecycle: string;
  totalSupplyRaw: string;
  minInvestmentRaw?: string;
  inception: string;
};

const dtfs: MockDtf[] = [
  {
    id: addr(0xd01),
    name: 'Magnificent 5',
    symbol: 'MAG5',
    manager: MOCK_WALLET,
    baseAssetId: USDG,
    weights: [
      ['TSLA', 2000],
      ['AMZN', 2000],
      ['NVDA', 2000],
      ['AAPL', 2000],
      ['MSFT', 2000],
    ],
    sharePrice: '1.0842',
    aum: '36527.40',
    fees: { entryBps: 30, exitBps: 30, managementBps: 50 },
    strategyType: 'standard',
    lifecycle: 'active',
    totalSupplyRaw: '33690000000',
    minInvestmentRaw: '25000000',
    inception: '2026-08-04T00:00:00Z',
  },
  {
    id: addr(0xd02),
    name: 'Robinhood WETH Integration',
    symbol: 'RWETH',
    manager: MOCK_WALLET,
    baseAssetId: USDG,
    weights: [
      ['WETH', 5000],
      ['SPY', 3000],
      ['NVDA', 2000],
    ],
    sharePrice: '0.9731',
    aum: '4822310.25',
    fees: { entryBps: 0, exitBps: 0, managementBps: 75 },
    strategyType: 'market_cap',
    lifecycle: 'active',
    totalSupplyRaw: '4955616000000',
    inception: '2026-07-12T00:00:00Z',
  },
  {
    id: addr(0xd03),
    name: 'US Treasury Yield',
    symbol: 'USTY',
    manager: OTHER_MANAGER,
    baseAssetId: USTB,
    weights: [['TBILL', 10000]],
    sharePrice: '1.0123',
    aum: '1250000',
    fees: { entryBps: 10, exitBps: 10, managementBps: 25 },
    strategyType: 'standard',
    lifecycle: 'active',
    totalSupplyRaw: '1234812000000',
    minInvestmentRaw: '1000000000',
    inception: '2026-06-01T00:00:00Z',
  },
  {
    id: addr(0xd04),
    name: 'AI Infrastructure',
    symbol: 'AINF',
    manager: MOCK_WALLET,
    baseAssetId: USDG,
    weights: [
      ['NVDA', 4000],
      ['MSFT', 3000],
      ['AMZN', 3000],
    ],
    sharePrice: '1',
    aum: '0',
    fees: { entryBps: 0, exitBps: 0, managementBps: 0 },
    strategyType: 'volatility',
    lifecycle: 'coming_soon',
    totalSupplyRaw: '0',
    inception: '2026-10-10T00:00:00Z',
  },
];

const NOW = '2026-10-15T09:00:00Z';

function dtfJson(d: MockDtf) {
  return {
    id: d.id,
    chainId: CHAIN_ID,
    name: d.name,
    symbol: d.symbol,
    manager: d.manager,
    contractAddress: d.id,
    baseAssetId: d.baseAssetId,
    baseAssetDecimals: 6,
    shareDecimals: 6,
    weights: d.weights.map(([symbol, weightBps]) => ({
      assetId: asset(symbol),
      weightBps,
    })),
    nav: d.aum,
    sharePrice: d.sharePrice,
    aum: d.aum,
    fees: d.fees,
    strategyType: d.strategyType,
    asOf: NOW,
    lifecycle: d.lifecycle,
    totalSupplyRaw: d.totalSupplyRaw,
    ...(d.minInvestmentRaw ? { minInvestmentRaw: d.minInvestmentRaw } : {}),
  };
}

/** Daily NAV points from inception to now, drifting up with some noise. */
function performance(d: MockDtf) {
  const days = 30;
  const end = Number(d.sharePrice);
  return Array.from({ length: days }, (_, i) => {
    const t = i / (days - 1);
    const price = (1 + (end - 1) * t + Math.sin(i * 1.7) * 0.004).toFixed(6);
    const at = new Date(Date.parse(NOW) - (days - 1 - i) * 86_400_000);
    return {
      observedAt: at.toISOString(),
      navValue: d.aum,
      sharePrice: price,
      totalSupplyRaw: d.totalSupplyRaw,
      valuationStatus: 'accepted',
    };
  });
}

function detailJson(d: MockDtf) {
  const coming = d.lifecycle === 'coming_soon';
  const available = (items: unknown[]) => ({ status: 'available', items });
  const changeBps = Math.round((Number(d.sharePrice) - 1) * 10_000);
  return {
    ...dtfJson(d),
    valuationStatus: 'accepted',
    priceSource: 'Chainlink',
    priceStale: false,
    readModels: {
      holdings: available(
        d.weights.map(([symbol, weightBps], i) => ({
          assetId: asset(symbol),
          quantityRaw: `${(162 + i * 13) * 10 ** 4}00000000000000`,
          targetWeightBps: weightBps,
          // Slight drift from target, so the allocation shows actual vs target.
          actualWeightBps: weightBps + (i % 2 === 0 ? 42 : -42),
          valuationStatus: 'accepted',
          asOf: NOW,
        })),
      ),
      performance: coming
        ? { status: 'unavailable' }
        : available(performance(d)),
      performanceDeltas: coming
        ? { status: 'unavailable' }
        : available([
            {
              window: 'latest',
              fromObservedAt: '2026-10-14T09:00:00Z',
              toObservedAt: NOW,
              sharePriceDelta: '0.0067',
              sharePriceDeltaBps: 62,
            },
            {
              window: 'inception',
              fromObservedAt: d.inception,
              toObservedAt: NOW,
              sharePriceDelta: (Number(d.sharePrice) - 1).toFixed(4),
              sharePriceDeltaBps: changeBps,
            },
          ]),
      recentTransactions: available(transactionsFor(d.id).slice(0, 5)),
      corporateActions: available([
        {
          id: `${d.id}-ca1`,
          assetId: asset('NVDA'),
          actionType: 'cash_dividend',
          effectiveAt: '2026-10-21T00:00:00Z',
          status: 'announced',
          payload: { amountPerShare: '0.01' },
        },
        {
          id: `${d.id}-ca2`,
          assetId: asset('AAPL'),
          actionType: 'cash_dividend',
          effectiveAt: '2026-09-30T00:00:00Z',
          status: 'effective',
          payload: { amountPerShare: '0.25' },
        },
      ]),
    },
  };
}

// ---------------------------------------------------------------------------
// Activity and portfolio
// ---------------------------------------------------------------------------

function transactionsFor(dtfId: string) {
  return [
    {
      id: `${dtfId}-t1`,
      action: 'invest',
      amountRaw: '500000000',
      shareAmountRaw: '459717200',
      occurredAt: '2026-10-12T14:20:00Z',
      walletAddress: MOCK_WALLET,
      status: 'confirmed',
    },
    {
      id: `${dtfId}-t2`,
      action: 'rebalance',
      occurredAt: '2026-10-11T08:00:00Z',
      walletAddress: null,
      status: 'confirmed',
    },
    {
      id: `${dtfId}-t3`,
      action: 'invest',
      amountRaw: '1000000000',
      shareAmountRaw: '1000000000',
      occurredAt: '2026-09-02T11:05:00Z',
      walletAddress: MOCK_WALLET,
      status: 'confirmed',
    },
    {
      id: `${dtfId}-t4`,
      action: 'redeem',
      amountRaw: '118000000',
      shareAmountRaw: '118000000',
      occurredAt: '2026-10-14T16:40:00Z',
      walletAddress: MOCK_WALLET,
      status: 'pending',
    },
  ].map((tx, i) => ({
    ...tx,
    dtfId,
    chainId: CHAIN_ID,
    txHash: `0x${(i + 1).toString(16).repeat(4)}${dtfId.slice(-8)}${'0'.repeat(52)}`,
    assetId: USDG,
  }));
}

/** What the signed-in wallet holds (shares are raw, 6 decimals). */
const positions = [
  { dtfId: dtfs[0]!.id, shares: '1500000000', value: '1626.30' },
  { dtfId: dtfs[1]!.id, shares: '1834700000', value: '1785.33' },
];

// ---------------------------------------------------------------------------
// Transactions (drafts and operations)
// ---------------------------------------------------------------------------

let opSeq = 1;

function operation(action: string, status: string, extra: object = {}) {
  return {
    id: `mock-op-${opSeq++}`,
    action,
    status,
    walletAddress: MOCK_WALLET,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    ...extra,
  };
}

function txDraft(
  action: string,
  to: string,
  data: Record<string, string> = {},
) {
  const op = operation(action, 'draft_prepared', { resourceId: to });
  return {
    action,
    requestId: op.id,
    operation: op,
    transaction: {
      to,
      data: `0x8f${'0'.repeat(66)}`,
      value: '0',
      chainId: CHAIN_ID,
      gas: '210000',
    },
    data,
    finalStep: true,
  };
}

// ---------------------------------------------------------------------------
// Manager (GET /manager/dtfs, /manager/dtfs/:id)
// ---------------------------------------------------------------------------

function managerDashboard(d: MockDtf) {
  return {
    ...dtfJson(d),
    feeRecipient: MOCK_WALLET,
    status: {
      paused: false,
      adminLocked: false,
      emergency: false,
      genesisDone: d.lifecycle !== 'coming_soon',
    },
    totalPendingUsdc: '1200.00',
    redeemQueue: { activeCount: 1, escrowUsdc: '118.00' },
    slots: d.weights.map(([symbol, targetBps], index) => ({
      index,
      assetId: asset(symbol),
      symbol,
      targetBps,
      currentBps: targetBps + (index === 0 ? 240 : -60),
      driftBps: index === 0 ? 240 : -60,
      pendingDeployUsdc: index === 1 ? '1200.00' : '0',
      valueUsdc: ((Number(d.aum) * targetBps) / 10_000).toFixed(2),
      pendingWriteOff: false,
      pendingReactivate: false,
    })),
    actions:
      d.lifecycle === 'coming_soon'
        ? [{ kind: 'genesis' }]
        : [
            { kind: 'rebalance', slotIndex: 0, driftBps: 240 },
            { kind: 'deploy', slotIndex: 1, amountUsdc: '1200.00' },
          ],
  };
}

// ---------------------------------------------------------------------------
// Router: method + path → JSON (called by lib/http.ts)
// ---------------------------------------------------------------------------

export type MockResult = { status: number; body: unknown };

const ok = (body: unknown): MockResult => ({ status: 200, body });
const fail = (status: number, code: string, message: string): MockResult => ({
  status,
  body: { error: { status, code, message, retryable: false } },
});

const findDtf = (id: string) =>
  dtfs.find(d => d.id.toLowerCase() === decodeURIComponent(id).toLowerCase());

type Route = [
  method: string,
  pattern: RegExp,
  handle: (
    match: RegExpMatchArray,
    body: Record<string, unknown>,
  ) => MockResult,
];

const ROUTES: Route[] = [
  // Session
  ['GET', /^\/auth\/me$/, () => ok({ user: signedIn ? user : null })],
  [
    'POST',
    /^\/auth\/siwe\/nonce$/,
    () =>
      ok({
        nonce: 'mock-nonce',
        message:
          'zenoindex.com wants you to sign in with your Ethereum account (mock).',
        expiresInSeconds: 300,
      }),
  ],
  [
    'POST',
    /^\/auth\/siwe\/verify$/,
    () => {
      signedIn = true;
      return ok({ user, token: 'mock-session-token' });
    },
  ],
  [
    'POST',
    /^\/auth\/logout$/,
    () => {
      signedIn = false;
      return ok({ ok: true });
    },
  ],
  [
    'POST',
    /^\/auth\/accept-terms$/,
    () => {
      user.termsAcceptedAt = NOW;
      user.privacyAcceptedAt = NOW;
      return ok({ user });
    },
  ],
  [
    'POST',
    /^\/auth\/profile$/,
    (_, body) => {
      Object.assign(user, {
        firstName: body['firstName'] ?? user.firstName,
        lastName: body['lastName'] ?? user.lastName,
        country: body['country'] ?? user.country,
        displayName: body['displayName'] ?? user.displayName,
      });
      return ok({ user });
    },
  ],

  // Catalogue
  [
    'GET',
    /^\/chains$/,
    () =>
      ok({
        items: [
          {
            chainId: CHAIN_ID,
            name: 'Robinhood Chain',
            network: 'mainnet',
            explorerUrl: 'https://explorer.mainnet.chain.robinhood.com',
          },
        ],
      }),
  ],
  ['GET', /^\/assets$/, () => ok({ items: assets })],
  ['GET', /^\/dtfs$/, () => ok({ items: dtfs.map(dtfJson) })],
  [
    'GET',
    /^\/dtfs\/([^/]+)$/,
    m => {
      const d = findDtf(m[1]!);
      return d
        ? ok(detailJson(d))
        : fail(404, 'not_found', 'Basket not found.');
    },
  ],
  [
    'GET',
    /^\/dtfs\/([^/]+)\/transactions$/,
    m => ok({ items: transactionsFor(decodeURIComponent(m[1]!)) }),
  ],

  // Trading
  [
    'POST',
    /^\/dtfs\/([^/]+)\/buy\/prepare$/,
    (m, body) => {
      const d = findDtf(m[1]!);
      if (!d) return fail(404, 'not_found', 'Basket not found.');
      const amount = Number(body['amount'] ?? 0);
      const fee = (amount * d.fees.entryBps) / 10_000;
      const shares = Math.floor(((amount - fee) / Number(d.sharePrice)) * 1e6);
      return ok(
        txDraft('invest', d.id, {
          entryFee: fee.toFixed(6),
          estimatedShares: String(shares),
        }),
      );
    },
  ],
  [
    'POST',
    /^\/dtfs\/([^/]+)\/redeem\/prepare$/,
    m => {
      const d = findDtf(m[1]!);
      return d
        ? ok({ ...txDraft('redeem', d.id), step: 'request', stepsRemaining: 0 })
        : fail(404, 'not_found', 'Basket not found.');
    },
  ],
  [
    'GET',
    /^\/operations\/([^/]+)$/,
    m => ok(operation('invest', 'confirmed', { id: m[1] })),
  ],
  [
    'POST',
    /^\/operations\/([^/]+)\/submit$/,
    (m, body) =>
      ok(
        operation('invest', 'submitted', { id: m[1], txHash: body['txHash'] }),
      ),
  ],
  [
    'POST',
    /^\/operations\/([^/]+)\/confirm$/,
    (m, body) =>
      ok(
        operation('invest', 'confirmed', {
          id: m[1],
          txHash: body['txHash'],
          confirmedAt: new Date().toISOString(),
        }),
      ),
  ],
  [
    'POST',
    /^\/operations\/([^/]+)\/fail$/,
    (m, body) =>
      ok(
        operation('invest', 'failed', {
          id: m[1],
          failureReason: body['reason'],
        }),
      ),
  ],

  // Portfolio and eligibility
  [
    'GET',
    /^\/wallets\/([^/]+)\/portfolio$/,
    m =>
      ok({
        wallet: decodeURIComponent(m[1]!),
        positions: positions.map(p => ({ ...p, asOf: NOW })),
      }),
  ],
  [
    'GET',
    /^\/compliance\/kyc\/([^/]+)\/status$/,
    m =>
      // status: 'Pending' | 'Approved' | 'Declined'; approved: true opens permissioned baskets.
      ok({
        wallet: decodeURIComponent(m[1]!),
        provider: 'didit',
        status: 'Pending',
        approved: false,
        sessionId: 'mock-kyc-session',
      }),
  ],
  [
    'POST',
    /^\/eligibility\/kyc\/start$/,
    () =>
      ok({
        sessionId: 'mock-kyc-session',
        url: 'https://verify.didit.me/',
        status: 'pending',
      }),
  ],

  // Manager mode
  [
    'GET',
    /^\/manager\/dtfs$/,
    () =>
      ok({ items: dtfs.filter(d => d.manager === MOCK_WALLET).map(dtfJson) }),
  ],
  [
    'GET',
    /^\/manager\/dtfs\/([^/]+)$/,
    m => {
      const d = findDtf(m[1]!);
      return d
        ? ok(managerDashboard(d))
        : fail(404, 'not_found', 'Basket not found.');
    },
  ],
  [
    'POST',
    /^\/manager\/dtfs\/([^/]+)\/([a-z-]+)\/prepare$/,
    m => {
      const d = findDtf(m[1]!);
      return d
        ? ok(txDraft(m[2]!, d.id))
        : fail(404, 'not_found', 'Basket not found.');
    },
  ],
];

/** Answers one API call from the data above (lib/http.ts, when USE_MOCK_DATA). */
export async function mockRequest(
  method: string,
  path: string,
  body: unknown,
): Promise<MockResult> {
  await new Promise(resolve => setTimeout(resolve, DELAY_MS));
  const [pathname] = path.split('?');
  for (const [m, pattern, handle] of ROUTES) {
    if (m !== method) continue;
    const match = pathname!.match(pattern);
    if (match) {
      // JSON round trip: screens never share (or mutate) the objects above.
      const result = handle(match, (body ?? {}) as Record<string, unknown>);
      return {
        status: result.status,
        body: JSON.parse(JSON.stringify(result.body)),
      };
    }
  }
  return fail(
    404,
    'mock_missing',
    `No mock data for ${method} ${pathname}. Add it in src/lib/data.ts.`,
  );
}
