/**
 * The app's only data boundary. Every screen reads through these functions,
 * which call zenoIndex-backend's /api/v1 (see src/lib/http.ts).
 */
import {
  listAssetsOf,
  listDtfsOf,
  toDtf,
  toDtfDetail,
  toKyc,
  toOperation,
  toTxDraft,
  toUser,
  toWalletPortfolio,
} from './adapters';
import { add, compare, div, fromRaw, mul, mulBps, sub } from './decimal';
import { ApiError, api, clearSession, setSessionToken } from './http';
import type {
  Asset,
  Dtf,
  DtfDetail,
  Eligibility,
  KycStatus,
  KycStatusResponse,
  Operation,
  Session,
  TradePreview,
  TxDraft,
  User,
  WalletPortfolio,
  WalletTransaction,
} from './types';

type Row = Record<string, unknown>;

// Auth ------------------------------------------------------------------------
// Everyone signs in through Privy (email code, Google, or an external wallet's
// SIWE); the backend verifies Privy's access token and signs in the user's
// wallet — that wallet is the account (privyLogin).

/**
 * POST /api/v1/auth/privy — exchanges a Privy access token for a Zeno session
 * on the user's embedded wallet, creating the account on first use.
 */
export async function privyLogin(accessToken: string): Promise<User> {
  const body = await api.post<{ user?: unknown; token?: unknown }>(
    '/auth/privy',
    { accessToken },
  );
  if (!body.user)
    throw new ApiError(500, 'bad_response', 'Sign-in failed.', true);
  if (typeof body.token === 'string') await setSessionToken(body.token);
  return toUser(body.user);
}

/** GET /api/v1/auth/me → the session user, or null when signed out. */
export async function getMe(): Promise<User | null> {
  const body = await api.get<{ user?: unknown }>('/auth/me');
  return body.user ? toUser(body.user) : null;
}

/** POST /api/v1/auth/accept-terms — accepts both documents at once. */
export async function acceptTerms(_user: User): Promise<User> {
  const body = await api.post<{ user?: unknown }>('/auth/accept-terms', {
    terms: true,
    privacy: true,
  });
  if (!body.user)
    throw new ApiError(500, 'bad_response', 'Could not save acceptance.', true);
  return toUser(body.user);
}

export type ProfileDetails = {
  firstName: string;
  lastName: string;
  country: string;
};

/** POST /api/v1/auth/profile */
export async function completeProfile(
  _user: User,
  details: ProfileDetails,
): Promise<User> {
  const body = await api.post<{ user?: unknown }>('/auth/profile', {
    firstName: details.firstName,
    lastName: details.lastName,
    country: details.country,
    displayName: `${details.firstName} ${details.lastName}`,
  });
  if (!body.user)
    throw new ApiError(500, 'bad_response', 'Could not save profile.', true);
  return toUser(body.user);
}

/** POST /api/v1/auth/logout — clears the session server- and client-side. */
export async function signOut(): Promise<void> {
  try {
    await api.post('/auth/logout');
  } finally {
    await clearSession();
  }
}

// Discovery -------------------------------------------------------------------

export type ChainInfo = {
  chainId: number;
  name?: string;
  network?: string;
  rpcUrl?: string;
  explorerUrl?: string;
};

/** GET /api/v1/chains — supported chains and their RPC/explorer endpoints. */
export async function listChains(): Promise<ChainInfo[]> {
  const body = await api.get<Row>('/chains');
  const items = Array.isArray(body['items']) ? body['items'] : [];
  return items.map(item => {
    const r = (item ?? {}) as Row;
    return {
      chainId: Number(r['chainId'] ?? r['id'] ?? 0),
      name: typeof r['name'] === 'string' ? r['name'] : undefined,
      network: typeof r['network'] === 'string' ? r['network'] : undefined,
      rpcUrl:
        typeof r['rpcUrl'] === 'string'
          ? r['rpcUrl']
          : typeof r['rpc'] === 'string'
            ? r['rpc']
            : undefined,
      explorerUrl:
        typeof r['explorerUrl'] === 'string'
          ? r['explorerUrl']
          : typeof r['explorer'] === 'string'
            ? r['explorer']
            : undefined,
    };
  });
}

/** GET /api/v1/dtfs */
export async function listDtfs(): Promise<Dtf[]> {
  return listDtfsOf(await api.get('/dtfs'));
}

/** GET /api/v1/assets */
export async function listAssets(): Promise<Asset[]> {
  return listAssetsOf(await api.get('/assets'));
}

/** GET /api/v1/dtfs/:id (read models arrive under `readModels` envelopes). */
export async function getDtf(id: string): Promise<DtfDetail> {
  return toDtfDetail(await api.get(`/dtfs/${encodeURIComponent(id)}`));
}

// Trading ----------------------------------------------------------------------

export type PrepareTradeInput = {
  /** Decimal string: base-asset amount to invest, or shares to redeem. */
  amount: string;
  /** Wallet that signs and receives (or pays out). */
  recipient: string;
  /** Shares owner for redeem; defaults to recipient. */
  owner?: string;
  slippageBps?: number;
};

/**
 * POST /api/v1/dtfs/:id/(buy|redeem)/prepare — builds the unsigned on-chain
 * transaction and records a `draft_prepared` operation.
 */
export async function prepareTrade(
  dtf: Dtf,
  side: TradePreview['side'],
  input: PrepareTradeInput,
): Promise<TxDraft> {
  const path =
    side === 'invest'
      ? `/dtfs/${encodeURIComponent(dtf.id)}/buy/prepare`
      : `/dtfs/${encodeURIComponent(dtf.id)}/redeem/prepare`;
  const body: Row =
    side === 'invest'
      ? { amount: input.amount, recipient: input.recipient }
      : {
          shares: input.amount,
          recipient: input.recipient,
          owner: input.owner ?? input.recipient,
        };
  if (input.slippageBps !== undefined) body['slippageBps'] = input.slippageBps;
  return toTxDraft(await api.post(path, body, { chainId: dtf.chainId }));
}

/**
 * Prepare-and-describe: the legacy preview entry point. There is no free
 * quote endpoint (the API's preview route needs venue liquidity config), so
 * the draft's `data` quote fields drive the displayed numbers. The created
 * draft operation is consumed by `confirmTrade` when the user signs.
 */
export async function previewTrade(
  dtf: Dtf,
  side: TradePreview['side'],
  amount: string,
  recipient: string,
): Promise<TradePreview> {
  const draft = await prepareTrade(dtf, side, { amount, recipient });
  const data = (draft.data ?? {}) as Row;

  const raw = (key: string): string | undefined =>
    typeof data[key] === 'string' ? (data[key] as string) : undefined;

  if (side === 'invest') {
    // The draft carries the exact quote: estimatedShares (raw share units)
    // and entryFee (raw base units).
    const fee = raw('entryFee')
      ? fromRaw(raw('entryFee')!, dtf.baseAssetDecimals)
      : mulBps(amount, dtf.fees.entryBps);
    const receive = raw('estimatedShares')
      ? fromRaw(raw('estimatedShares')!, dtf.shareDecimals)
      : div(sub(amount, fee), dtf.sharePrice);
    return {
      side,
      pay: amount,
      receive,
      feeBps: dtf.fees.entryBps,
      fee,
      quotedSharePrice: dtf.sharePrice,
      draft,
    };
  }
  const gross = raw('estimatedBaseOut')
    ? fromRaw(raw('estimatedBaseOut')!, dtf.baseAssetDecimals)
    : mul(amount, dtf.sharePrice);
  const fee = raw('exitFee')
    ? fromRaw(raw('exitFee')!, dtf.baseAssetDecimals)
    : mulBps(gross, dtf.fees.exitBps);
  return {
    side,
    pay: amount,
    receive: sub(gross, fee),
    feeBps: dtf.fees.exitBps,
    fee,
    quotedSharePrice: dtf.sharePrice,
    draft,
  };
}

// Operations -------------------------------------------------------------------

/** POST /api/v1/operations/:id/submit — record the broadcast tx hash. */
export async function submitOperation(
  id: string,
  txHash: string,
): Promise<Operation> {
  return toOperation(
    await api.post(`/operations/${encodeURIComponent(id)}/submit`, { txHash }),
  );
}

/** POST /api/v1/operations/:id/confirm — mark the operation confirmed. */
export async function confirmOperation(
  id: string,
  txHash: string,
): Promise<Operation> {
  return toOperation(
    await api.post(`/operations/${encodeURIComponent(id)}/confirm`, { txHash }),
  );
}

/** POST /api/v1/operations/:id/fail — record a reverted/abandoned tx. */
export async function failOperation(
  id: string,
  txHash: string | undefined,
  reason?: string,
): Promise<Operation> {
  return toOperation(
    await api.post(`/operations/${encodeURIComponent(id)}/fail`, {
      ...(txHash ? { txHash } : {}),
      ...(reason ? { reason } : {}),
    }),
  );
}

/** GET /api/v1/operations/:id */
export async function getOperation(id: string): Promise<Operation> {
  return toOperation(await api.get(`/operations/${encodeURIComponent(id)}`));
}

/**
 * Polls an operation until it reaches a terminal status (or times out).
 * Mirrors the web app's trackOperation.
 */
export async function trackOperation(
  id: string,
  onUpdate?: (operation: Operation) => void,
  options?: { intervalMs?: number; maxAttempts?: number },
): Promise<Operation> {
  const intervalMs = options?.intervalMs ?? 2_000;
  const maxAttempts = options?.maxAttempts ?? 60;
  for (let attempt = 0; attempt <= maxAttempts; attempt += 1) {
    const op = await getOperation(id);
    onUpdate?.(op);
    if (op.status === 'failed') {
      throw new ApiError(
        500,
        'operation_failed',
        `Operation ${id} failed.`,
        false,
      );
    }
    if (op.status === 'confirmed' || op.status === 'draft_prepared') return op;
    if (attempt < maxAttempts) {
      await new Promise(resolve => setTimeout(resolve, intervalMs));
    }
  }
  throw new ApiError(
    0,
    'timeout',
    `Operation ${id} confirmation timed out.`,
    true,
  );
}

// Manager ----------------------------------------------------------------------
// Baskets the signed-in wallet manages (vault manager or vault operator). The
// API answers 403 not_manager for anyone else.

/** GET /api/v1/manager/dtfs */
export async function listManagedDtfs(): Promise<Dtf[]> {
  return listDtfsOf(await api.get('/manager/dtfs'));
}

/** Something the basket needs from its manager (the dashboard's to-do list). */
export type ManagerAction =
  | { kind: 'genesis' }
  /** Invest USDG that deposits left waiting in this slot. */
  | { kind: 'deploy'; slotIndex: number; amountUsdc: string }
  /** Trade this slot back toward its target weight. */
  | { kind: 'rebalance'; slotIndex: number; driftBps: number };

export type ManagerSlot = {
  index: number;
  assetId: string;
  symbol: string | null;
  targetBps: number;
  /** null while the asset has no fresh price. */
  currentBps: number | null;
  driftBps: number | null;
  pendingDeployUsdc: string;
  valueUsdc: string | null;
  pendingWriteOff: boolean;
  pendingReactivate: boolean;
};

export type ManagerDashboard = {
  dtf: Dtf;
  feeRecipient: string;
  status: {
    paused: boolean;
    adminLocked: boolean;
    emergency: boolean;
    genesisDone: boolean;
  };
  totalPendingUsdc: string;
  redeemQueue: { activeCount: number; escrowUsdc: string };
  slots: ManagerSlot[];
  actions: ManagerAction[];
};

/** GET /api/v1/manager/dtfs/:id */
export async function getManagerDashboard(
  id: string,
): Promise<ManagerDashboard> {
  const raw = await api.get<Row & Omit<ManagerDashboard, 'dtf'>>(
    `/manager/dtfs/${encodeURIComponent(id)}`,
  );
  return {
    dtf: toDtf(raw),
    feeRecipient: raw.feeRecipient,
    status: raw.status,
    totalPendingUsdc: raw.totalPendingUsdc,
    redeemQueue: raw.redeemQueue,
    slots: raw.slots,
    actions: raw.actions,
  };
}

/** Body of each POST /manager/dtfs/:id/<name>/prepare. */
export type ManagerPrepare =
  | { name: 'genesis'; body: { baselineSharePrice: string } }
  | { name: 'deploy'; body: { slotIndex: number; slippageBps?: number } }
  | { name: 'rebalance'; body: { slotIndex: number; slippageBps?: number } }
  | {
      name: 'allocations';
      body: { weights: { assetId: string; weightBps: number }[] };
    }
  | { name: 'pause'; body: { paused: boolean } }
  | { name: 'write-off' | 'reactivate'; body: { assetId: string } };

/**
 * POST /api/v1/manager/dtfs/:id/<name>/prepare — an unsigned transaction on
 * the same operations flow as trades (sign → submitOperation → confirm).
 */
export async function prepareManagerTx(
  dtf: Dtf,
  { name, body }: ManagerPrepare,
): Promise<TxDraft> {
  return toTxDraft(
    await api.post(
      `/manager/dtfs/${encodeURIComponent(dtf.id)}/${name}/prepare`,
      body,
      { chainId: dtf.chainId },
    ),
  );
}

/**
 * The wallet's manager fees: every deposit / redeem fee is escrowed and the
 * manager's share accrues to one balance across all their baskets.
 * `available` is false until the contracts with FeeEscrow are deployed.
 */
export type ManagerFees = {
  available: boolean;
  token: string;
  /** USDG, decimal. */
  claimable: string;
  claimableRaw: string;
  /** Baskets this wallet is the manager of. */
  baskets: number;
};

/** GET /api/v1/manager/fees */
export async function getManagerFees(): Promise<ManagerFees> {
  return api.get<ManagerFees>('/manager/fees');
}

/** POST /api/v1/manager/fees/claim/prepare — pays the whole balance to the wallet. */
export async function prepareFeeClaim(chainId: number): Promise<TxDraft> {
  return toTxDraft(
    await api.post('/manager/fees/claim/prepare', {}, { chainId }),
  );
}

/** What GET /manager/create offers: who may create, and the assets to pick. */
export type CreateOptions = {
  /** Only the super-admin and wallets it allowlisted can create baskets. */
  canCreate: boolean;
  /** USDG — every basket is priced and bought in it. */
  baseAssetId: string;
  assets: {
    id: string;
    symbol: string;
    name: string;
    logoUrl: string | null;
    /** false until the asset has a price (createVault needs one). */
    selectable: boolean;
  }[];
  limits: {
    maxAssets: number;
    maxEntryFeeBps: number;
    minExitFeeBps: number;
    maxExitFeeBps: number;
  };
};

/** GET /api/v1/manager/create */
export async function getCreateOptions(): Promise<CreateOptions> {
  return api.get<CreateOptions>('/manager/create');
}

export type CreateBasketInput = {
  name: string;
  symbol: string;
  weights: { assetId: string; weightBps: number }[];
  entryFeeBps: number;
  exitFeeBps: number;
  feeRecipient?: string;
};

/** POST /api/v1/manager/create/prepare — createVault; the signer becomes the manager. */
export async function prepareCreateBasket(
  chainId: number,
  input: CreateBasketInput,
): Promise<TxDraft> {
  return toTxDraft(
    await api.post('/manager/create/prepare', input, { chainId }),
  );
}

// Portfolio --------------------------------------------------------------------

export type PortfolioView = {
  portfolio: WalletPortfolio;
  /** Amount paid into each basket, keyed by DTF id. */
  costBasis: Record<string, string>;
  activity: WalletTransaction[];
  /** 'api' when the read model answered; 'chain' for the balanceOf fallback. */
  source: 'api' | 'chain';
};

/**
 * GET /api/v1/wallets/:wallet/portfolio, then the wallet's own transactions
 * per listed DTF. The API portfolio endpoint is a stub today (BUG-1): when it
 * returns no positions, `positionsFromChain` fills them in from on-chain
 * share balances so the screen isn't silently empty.
 */
export async function getPortfolio(
  wallet: string,
  positionsFromChain?: (dtfs: Dtf[]) => Promise<WalletPortfolio['positions']>,
): Promise<PortfolioView> {
  const body = await api.get<Row>(
    `/wallets/${encodeURIComponent(wallet)}/portfolio`,
  );
  const portfolio = toWalletPortfolio(body);

  const dtfs = await listDtfs().catch(() => [] as Dtf[]);
  let source: PortfolioView['source'] = 'api';
  if (
    portfolio.positions.length === 0 &&
    positionsFromChain &&
    dtfs.length > 0
  ) {
    try {
      const positions = await positionsFromChain(dtfs);
      if (positions.length > 0) {
        portfolio.positions = positions;
        source = 'chain';
      }
    } catch {
      // Chain reads are best-effort; an empty portfolio is shown as such.
    }
  }

  // Cost basis and activity come from the wallet's indexed transactions.
  const activity = await walletActivity(wallet, dtfs);
  const costBasis = costBasisOf(activity, dtfs, portfolio.positions);
  return { portfolio, costBasis, activity, source };
}

/**
 * What the wallet paid for the shares it still holds, per basket (average
 * cost). Invests add their cost and shares; a redeem removes the same
 * fraction of the cost as of the shares it burned. If redeems are missing
 * from the indexed history, the cost is scaled down to the shares actually
 * held, so a sold position never counts against the current one.
 */
export function costBasisOf(
  activity: readonly WalletTransaction[],
  dtfs: readonly Dtf[],
  positions: WalletPortfolio['positions'],
): Record<string, string> {
  const tracked = new Map<string, { cost: string; shares: string | null }>();
  const oldestFirst = [...activity]
    .filter(tx => tx.status === 'confirmed')
    .sort((a, b) => Date.parse(a.occurredAt) - Date.parse(b.occurredAt));

  for (const tx of oldestFirst) {
    const dtf = dtfs.find(d => d.id === tx.dtfId);
    if (!dtf) continue;
    const t = tracked.get(tx.dtfId) ?? { cost: '0', shares: '0' };
    const moved = tx.shareAmountRaw
      ? fromRaw(tx.shareAmountRaw, dtf.shareDecimals)
      : null;
    if (tx.action === 'invest') {
      if (!tx.amountRaw) continue;
      t.cost = add(t.cost, fromRaw(tx.amountRaw, dtf.baseAssetDecimals));
      // Without the minted amount the share count is unknown from here on.
      t.shares = moved && t.shares !== null ? add(t.shares, moved) : null;
    } else if (moved && t.shares !== null && compare(t.shares, '0') > 0) {
      const burned = compare(moved, t.shares) > 0 ? t.shares : moved;
      t.cost = sub(t.cost, mul(t.cost, div(burned, t.shares)));
      t.shares = sub(t.shares, burned);
    }
    tracked.set(tx.dtfId, t);
  }

  const result: Record<string, string> = {};
  for (const [dtfId, t] of tracked) {
    const dtf = dtfs.find(d => d.id === dtfId)!;
    const position = positions.find(p => p.dtfId === dtfId);
    if (!position) continue;
    const held = fromRaw(position.shares, dtf.shareDecimals);
    let cost = t.cost;
    if (t.shares !== null && compare(held, t.shares) < 0) {
      cost = compare(t.shares, '0') > 0 ? mul(cost, div(held, t.shares)) : '0';
    }
    if (compare(cost, '0') > 0) result[dtfId] = cost;
  }
  return result;
}

/** Fetch each DTF's transactions and keep the wallet's, newest first. */
async function walletActivity(
  wallet: string,
  dtfs: Dtf[],
): Promise<WalletTransaction[]> {
  const lower = wallet.toLowerCase();
  const lists = await Promise.all(
    dtfs.map(async dtf => {
      try {
        const body = await api.get<Row>(
          `/dtfs/${encodeURIComponent(dtf.id)}/transactions`,
        );
        const items = Array.isArray(body['items']) ? body['items'] : [];
        return items.map(item => {
          const tx = toTransactionLike((item ?? {}) as Row);
          return { ...tx, dtfId: dtf.id };
        });
      } catch {
        return [] as WalletTransaction[];
      }
    }),
  );
  return lists
    .flat()
    .filter(tx => tx.walletAddress?.toLowerCase() === lower)
    .sort((a, b) => Date.parse(b.occurredAt) - Date.parse(a.occurredAt));
}

function toTransactionLike(raw: Row): WalletTransaction {
  const status =
    typeof raw['status'] === 'string' ? raw['status'] : 'confirmed';
  return {
    id: String(raw['id'] ?? raw['txHash'] ?? ''),
    dtfId: String(raw['dtfId'] ?? ''),
    chainId: typeof raw['chainId'] === 'number' ? raw['chainId'] : 0,
    txHash: String(raw['txHash'] ?? ''),
    action: String(raw['action'] ?? ''),
    walletAddress:
      typeof raw['walletAddress'] === 'string' ? raw['walletAddress'] : null,
    assetId:
      typeof raw['assetId'] === 'string' ? raw['assetId'].toLowerCase() : null,
    amountRaw: typeof raw['amountRaw'] === 'string' ? raw['amountRaw'] : null,
    shareAmountRaw:
      typeof raw['shareAmountRaw'] === 'string' ? raw['shareAmountRaw'] : null,
    status:
      status === 'pending' || status === 'reverted' ? status : 'confirmed',
    occurredAt:
      typeof raw['occurredAt'] === 'string'
        ? raw['occurredAt']
        : typeof raw['createdAt'] === 'string'
          ? raw['createdAt']
          : '',
  };
}

// Compliance -------------------------------------------------------------------

function mapKycStatus(status: string, approved: boolean): KycStatus {
  if (approved || status === 'Verified' || status === 'approved')
    return 'verified';
  if (status === 'Rejected' || status === 'rejected' || status === 'declined')
    return 'rejected';
  if (
    status === 'Pending' ||
    status === 'Under Review' ||
    status === 'in_review' ||
    status === 'pending'
  )
    return 'pending';
  return 'not_started';
}

/** GET /api/v1/compliance/kyc/:wallet/status */
export async function getEligibility(
  wallet: string | null,
): Promise<Eligibility> {
  if (!wallet) {
    return {
      kycStatus: 'not_started',
      provider: 'didit',
      verifiedAt: null,
      permissionedAccess: false,
    };
  }
  const kyc = toKyc(
    await api.get(`/compliance/kyc/${encodeURIComponent(wallet)}/status`),
  );
  return {
    kycStatus: mapKycStatus(kyc.status, kyc.approved),
    provider: 'Didit',
    verifiedAt: null,
    permissionedAccess: kyc.approved,
  };
}

export type KycSession = { sessionId: string; url?: string; status: string };

/**
 * POST /api/v1/eligibility/kyc/start — returns the provider session URL to
 * open in the browser. Throws ApiError("didit_not_configured"-style) when the
 * hosted app has no KYC provider credentials.
 */
export async function startKyc(wallet: string): Promise<KycSession> {
  const body = await api.post<Row>('/eligibility/kyc/start', { wallet });
  return {
    sessionId: String(body['sessionId'] ?? ''),
    url: typeof body['url'] === 'string' ? body['url'] : undefined,
    status: String(body['status'] ?? 'pending'),
  };
}

/** GET /api/v1/compliance/kyc/:wallet/status — raw provider payload. */
export async function getKycStatus(wallet: string): Promise<KycStatusResponse> {
  return toKyc(
    await api.get(`/compliance/kyc/${encodeURIComponent(wallet)}/status`),
  );
}

// Sessions ---------------------------------------------------------------------

/**
 * There is no sessions API; the row shown is just the session this device is
 * holding right now.
 */
export async function listSessions(): Promise<Session[]> {
  return [
    {
      id: 'current',
      device: 'This device',
      lastActive: new Date().toISOString(),
      current: true,
    },
  ];
}

export { ApiError };
