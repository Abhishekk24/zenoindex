/**
 * API shapes the app reads, copied from programmable-dtf-infra
 * packages/core-api/src/index.ts and trimmed to the fields used here.
 * Money and quantities are decimal strings, never `number`; `*Bps` fields
 * are basis points and `*Raw` fields are integer base units.
 * Keep in sync by hand until the app talks to the web app's /api/v1.
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
  strategy?: { type: StrategyType; driftThresholdBps?: number };
  asOf: string;
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

/**
 * The API nests these lists under `readModels`, each either available or
 * unavailable with a reason; the app flattens them in lib/api.ts.
 */
export type DtfDetail = Dtf & {
  valuationStatus: 'accepted' | 'unavailable';
  totalSupplyRaw?: string;
  holdings: DtfHolding[];
  performance: NavHistoryPoint[];
  performanceDeltas: PerformanceDelta[];
  recentTransactions: DtfTransaction[];
  corporateActions: CorporateAction[];
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

export type TxDraft = {
  action: string;
  requestId: string;
  transaction: {
    to: string;
    data: Hex;
    value: string;
    chainId: number;
    gas?: string;
  };
  data: unknown;
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

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  firstName: string | null;
  lastName: string | null;
  country: string | null;
  wallets: LinkedWallet[];
  twoFactorEnabled: boolean;
  termsAcceptedAt: string | null;
  /** Profile completion; null until the profile step is done. */
  profileCompletedAt: string | null;
  createdAt: string;
};

export type KycStatus = 'not_started' | 'pending' | 'verified' | 'rejected';

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
