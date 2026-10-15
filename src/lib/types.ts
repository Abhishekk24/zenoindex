/**
 * API shapes the app reads, matching the hosted app's /api/v1 responses
 * (verified against programmable-dtf-infra core-api + dtf-app). Money and
 * quantities are decimal strings, never `number`; `*Bps` fields are basis
 * points and `*Raw` fields are integer base units.
 */

export type Hex = `0x${string}`;

export type Asset = {
  id: string;
  symbol: string;
  name: string;
  chainId: number;
  contractAddress: string;
  decimals: number;
  oracleStatus: 'accepted' | 'stale' | 'unavailable';
  tradable: boolean;
  mode: 'zap' | 'in-kind';
  underlyingTransferPolicy?:
    'open' | 'issuer_allowlist' | 'venue_gated' | 'unknown';
  /** Token logo (Robinhood's asset list); null when there is none, e.g. USDG. */
  logoUrl?: string | null;
};

export type Weight = { assetId: string; weightBps: number };

export type StrategyType =
  'standard' | 'market-cap-weighted' | 'volatility-weighted';

export type DtfStatus = 'coming_soon' | 'active';

export type Dtf = {
  id: string;
  chainId: number;
  name: string;
  symbol: string;
  manager: string;
  contractAddress?: string;
  baseAssetId: string;
  baseAssetDecimals: number;
  shareDecimals: number;
  weights: Weight[];
  nav: string;
  sharePrice: string;
  aum: string;
  fees: { entryBps: number; exitBps: number; managementBps: number };
  minInvestment?: string | null;
  /** Raw integer min investment in base-asset units, when the API provides it. */
  minInvestmentRaw?: string;
  strategy?: { type: StrategyType; driftThresholdBps?: number };
  asOf: string;
  /** Lifecycle value from the read model, e.g. 'coming_soon', 'active'. */
  lifecycle?: string;
  /** App-side listing state (web: AppDtf). */
  isPublished?: boolean;
};

export type DtfHolding = {
  assetId: string;
  quantityRaw: string;
  targetWeightBps: number | null;
  actualWeightBps: number | null;
  valuationStatus: 'accepted' | 'stale' | 'unavailable';
  asOf: string;
};

export type NavHistoryPoint = {
  observedAt: string;
  navValue: string;
  sharePrice: string;
  totalSupplyRaw: string;
  valuationStatus: 'accepted' | 'stale' | 'unavailable';
};

export type PerformanceDelta = {
  window: 'latest' | 'inception';
  fromObservedAt: string;
  toObservedAt: string;
  sharePriceDelta: string;
  sharePriceDeltaBps: number;
};

export type DtfTransaction = {
  id: string;
  chainId: number;
  txHash: string;
  action: string;
  walletAddress: string | null;
  assetId: string | null;
  amountRaw: string | null;
  shareAmountRaw: string | null;
  status: 'pending' | 'confirmed' | 'reverted';
  occurredAt: string;
};

export type CorporateAction = {
  id: string;
  assetId: string;
  actionType: string;
  effectiveAt: string;
  status: 'announced' | 'effective' | 'cancelled';
  payload: unknown;
};

/** Availability flag for an indexed read model. */
export type Availability = 'available' | 'unavailable';

/**
 * The API nests these lists under `readModels`, each either available or
 * unavailable with a reason; lib/adapters.ts flattens them and keeps the
 * availability flags so screens can show "indexing pending" instead of an
 * empty list.
 */
export type DtfDetail = Dtf & {
  valuationStatus: 'accepted' | 'unavailable';
  totalSupplyRaw?: string;
  priceStale?: boolean;
  priceSource?: string;
  holdings: DtfHolding[];
  performance: NavHistoryPoint[];
  performanceDeltas: PerformanceDelta[];
  recentTransactions: DtfTransaction[];
  corporateActions: CorporateAction[];
  /** The NAV history and price changes are demo data (no real history yet); label them. */
  demoStats: boolean;
  readModels: {
    holdings: Availability;
    performance: Availability;
    performanceDeltas: Availability;
    recentTransactions: Availability;
    corporateActions: Availability;
  };
};

export type WalletPortfolio = {
  wallet: string;
  positions: {
    dtfId: string;
    shares: string;
    value: string;
    asOf: string;
  }[];
};

/** A wallet's transaction across baskets (web: RecentTransaction). */
export type WalletTransaction = DtfTransaction & { dtfId: string };

/** An operation tracked by the API (prepare → submit → confirm/fail). */
export type Operation = {
  id: string;
  action: string;
  status: 'draft_prepared' | 'submitted' | 'confirmed' | 'failed' | string;
  resourceId?: string;
  walletAddress?: string;
  txHash?: string;
  createdAt?: string;
  updatedAt?: string;
  submittedAt?: string;
  confirmedAt?: string;
};

/** A prepared transaction returned by `…/prepare` endpoints. */
export type TxDraft = {
  action: string;
  /** The operation id — the same value the API tracks under /operations/:id. */
  requestId: string;
  transaction: {
    to: string;
    data: Hex;
    value: string;
    chainId: number;
    gas?: string;
    nonce?: string;
    maxFeePerGas?: string;
    maxPriorityFeePerGas?: string;
  };
  /** Action-specific extras (quotes, estimatedBaseOut, shareAmount, …). */
  data: Record<string, unknown> | unknown;
  operation?: Operation;
  /** Redeem only: false while more sell steps (swap/claim) follow this one. */
  finalStep?: boolean;
};

/** What the Invest/Redeem panel shows before the wallet signs. */
export type TradePreview = {
  side: 'invest' | 'redeem';
  /** What the user gives: base asset for invest, shares for redeem. */
  pay: string;
  /** What the user gets: shares for invest, base asset for redeem. */
  receive: string;
  feeBps: number;
  fee: string;
  quotedSharePrice: string;
  draft: TxDraft;
};

export type LinkedWallet = {
  address: string;
  chainId: number;
  primary?: boolean;
};

/** Matches the web app's `publicUser` shape. */
export type User = {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  /** The primary wallet address (server-side canonical field). */
  walletAddress: string | null;
  wallets: LinkedWallet[];
  twoFactorEnabled: boolean;
  termsAcceptedAt: string | null;
  privacyAcceptedAt: string | null;
  createdAt: string;
};

/** Normalized client-side KYC status (backend: didit status strings). */
export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

/** Raw shape returned by GET /compliance/kyc/:wallet/status. */
export type KycStatusResponse = {
  wallet: string;
  provider: 'didit' | string;
  status: 'Pending' | 'Under Review' | 'Verified' | 'Rejected' | string;
  approved: boolean;
  sessionId?: string;
  attestationId?: string;
  rawStatus?: string;
};

export type Eligibility = {
  kycStatus: KycStatus;
  provider: string;
  verifiedAt: string | null;
  permissionedAccess: boolean;
};

export type Session = {
  id: string;
  device: string;
  lastActive: string;
  current: boolean;
};
