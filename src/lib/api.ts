/**
 * The app's only data boundary. Every screen reads through these functions,
 * which call the hosted app's /api/v1 proxy. The proxy owns the session and
 * the core API key, so the app never calls the core API directly.
 *
 * Sample data (lib/data.ts) remains only behind __DEV__ escape hatches.
 */
import {
  listAssetsOf,
  listDtfsOf,
  toDtfDetail,
  toKyc,
  toOperation,
  toTxDraft,
  toUser,
  toWalletPortfolio,
} from './adapters';
import { add, div, fromRaw, mul, mulBps, sub } from './decimal';
import { ApiError, api, clearSession } from './http';
import { sampleUser } from './data';
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

export type OtpResult = {
  email: string;
  status: 'sent' | 'rate_limited' | 'not_configured' | string;
  /** Seconds before another code can be requested (when rate limited). */
  resendAfterSeconds?: number;
  expiresInSeconds?: number;
};

function toOtpResult(body: unknown): OtpResult {
  const r = (body ?? {}) as Row;
  return {
    email: String(r['email'] ?? ''),
    status: String(r['status'] ?? 'sent'),
    resendAfterSeconds:
      typeof r['resendAfterSeconds'] === 'number'
        ? r['resendAfterSeconds']
        : undefined,
    expiresInSeconds:
      typeof r['expiresInSeconds'] === 'number'
        ? r['expiresInSeconds']
        : undefined,
  };
}

/** POST /api/v1/auth/otp/request */
export async function requestEmailCode(email: string): Promise<OtpResult> {
  const body = await api.post('/auth/otp/request', {
    email,
    purpose: 'login',
  });
  return toOtpResult(body);
}

/** POST /api/v1/auth/otp/resend */
export async function resendEmailCode(email: string): Promise<OtpResult> {
  const body = await api.post('/auth/otp/resend', {
    email,
    purpose: 'login',
  });
  return toOtpResult(body);
}

/**
 * POST /api/v1/auth/otp/verify. The response carries the `dtf_session`
 * cookie, which the HTTP layer captures into SecureStore.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<User> {
  if (!/^\d{6}$/.test(code))
    throw new ApiError(
      400,
      'invalid_code',
      'Enter the 6-digit code from your email.',
      false,
    );
  const body = await api.post<{ user?: unknown }>('/auth/otp/verify', {
    email,
    purpose: 'login',
    code,
  });
  if (!body.user)
    throw new ApiError(500, 'bad_response', 'Sign-in failed.', true);
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

// Wallet linking ---------------------------------------------------------------

export type WalletChallenge = {
  message: string;
  expiresInSeconds: number;
};

/**
 * POST /api/v1/auth/wallet/challenge — a server-issued message the wallet
 * signs (EIP-191 `personal_sign`) to prove ownership.
 */
export async function requestWalletChallenge(
  walletAddress: string,
): Promise<WalletChallenge> {
  const body = await api.post<Row>('/auth/wallet/challenge', { walletAddress });
  const message = typeof body['message'] === 'string' ? body['message'] : '';
  if (!message)
    throw new ApiError(
      500,
      'bad_response',
      'The server sent no challenge.',
      true,
    );
  return {
    message,
    expiresInSeconds:
      typeof body['expiresInSeconds'] === 'number'
        ? body['expiresInSeconds']
        : 300,
  };
}

/**
 * POST /api/v1/auth/wallet/verify — the server recovers the signer from the
 * signature, checks it against the stored challenge and links the wallet.
 */
export async function verifyWalletLink(input: {
  message: string;
  signature: string;
  chainId: number;
}): Promise<User> {
  const body = await api.post<{ user?: unknown }>('/auth/wallet/verify', {
    message: input.message,
    signature: input.signature,
    chainId: input.chainId,
  });
  if (!body.user)
    throw new ApiError(
      500,
      'bad_response',
      'Wallet verification failed.',
      true,
    );
  return toUser(body.user);
}

/**
 * POST /api/v1/auth/wallet/login/challenge — the message a wallet signs to
 * sign in (no account or session needed).
 */
export async function requestWalletLoginChallenge(
  walletAddress: string,
): Promise<WalletChallenge> {
  const body = await api.post<Row>('/auth/wallet/login/challenge', {
    walletAddress,
  });
  const message = typeof body['message'] === 'string' ? body['message'] : '';
  if (!message)
    throw new ApiError(
      500,
      'bad_response',
      'The server sent no challenge.',
      true,
    );
  return {
    message,
    expiresInSeconds:
      typeof body['expiresInSeconds'] === 'number'
        ? body['expiresInSeconds']
        : 300,
  };
}

/**
 * POST /api/v1/auth/wallet/login — the server recovers the signer and signs
 * in that wallet's account, creating one on first use (terms and profile
 * still follow). The `dtf_session` cookie is captured by the HTTP layer.
 */
export async function walletLogin(input: {
  walletAddress: string;
  message: string;
  signature: string;
}): Promise<User> {
  const body = await api.post<{ user?: unknown }>('/auth/wallet/login', input);
  if (!body.user)
    throw new ApiError(500, 'bad_response', 'Wallet sign-in failed.', true);
  return toUser(body.user);
}

/** GET /api/v1/auth/wallets */
export async function listLinkedWallets(): Promise<{
  wallets: User['wallets'];
  primary: string | null;
}> {
  const body = await api.get<Row>('/auth/wallets');
  const wallets = Array.isArray(body['wallets']) ? body['wallets'] : [];
  const primary =
    typeof body['primary'] === 'string' ? body['primary'].toLowerCase() : null;
  return {
    wallets: wallets.map(w => {
      const r = (w ?? {}) as Row;
      const address = String(r['address'] ?? '');
      return {
        address,
        chainId: typeof r['chainId'] === 'number' ? r['chainId'] : 0,
        primary: primary !== null && address.toLowerCase() === primary,
      };
    }),
    primary: typeof body['primary'] === 'string' ? body['primary'] : null,
  };
}

/** DELETE /api/v1/auth/wallets/:wallet */
export async function removeWallet(wallet: string): Promise<User> {
  const body = await api.delete<{ user?: unknown }>(
    `/auth/wallets/${encodeURIComponent(wallet)}`,
  );
  if (!body.user)
    throw new ApiError(
      500,
      'bad_response',
      'Could not remove the wallet.',
      true,
    );
  return toUser(body.user);
}

/** POST /api/v1/auth/wallets/:wallet/primary */
export async function setPrimaryWallet(wallet: string): Promise<User> {
  const body = await api.post<{ user?: unknown }>(
    `/auth/wallets/${encodeURIComponent(wallet)}/primary`,
  );
  if (!body.user)
    throw new ApiError(
      500,
      'bad_response',
      'Could not set the primary wallet.',
      true,
    );
  return toUser(body.user);
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
  const costBasis: Record<string, string> = {};
  for (const tx of activity) {
    if (tx.action !== 'invest' || !tx.amountRaw) continue;
    const dtf = dtfs.find(d => d.id === tx.dtfId);
    if (!dtf) continue;
    const paid = fromRaw(tx.amountRaw, dtf.baseAssetDecimals);
    costBasis[tx.dtfId] = costBasis[tx.dtfId]
      ? add(costBasis[tx.dtfId]!, paid)
      : paid;
  }

  return { portfolio, costBasis, activity, source };
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

/** Development only: sign straight in as the sample investor (offline UI). */
export function sampleInvestor(): User {
  return sampleUser();
}

export { ApiError };
