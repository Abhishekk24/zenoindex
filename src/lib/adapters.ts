/**
 * Maps raw /api/v1 payloads onto the app's types. Keep every field permissive:
 * the hosted API evolves independently, so unknown fields are ignored and
 * missing ones degrade to `undefined`/empty rather than throwing.
 */
import { fromRaw } from './decimal';
import type {
  Asset,
  Availability,
  CorporateAction,
  Dtf,
  DtfDetail,
  DtfHolding,
  DtfTransaction,
  KycStatusResponse,
  NavHistoryPoint,
  Operation,
  PerformanceDelta,
  StrategyType,
  TxDraft,
  User,
  WalletPortfolio,
} from './types';

type Row = Record<string, unknown>;

const str = (v: unknown): string | undefined =>
  typeof v === 'string' && v.length > 0 ? v : undefined;
const num = (v: unknown): number | undefined =>
  typeof v === 'number' && Number.isFinite(v) ? v : undefined;
const arr = (v: unknown): Row[] => (Array.isArray(v) ? (v as Row[]) : []);
const obj = (v: unknown): Row | undefined =>
  typeof v === 'object' && v !== null ? (v as Row) : undefined;

function items<T>(body: unknown, map: (row: Row) => T): T[] {
  const items = obj(body)?.['items'];
  return arr(items).map(map);
}

// Auth ------------------------------------------------------------------------

/** publicUser from the web auth service. */
export function toUser(raw: unknown): User {
  const r = obj(raw) ?? {};
  const wallets = arr(r['wallets']).map(w => {
    const wr = obj(w) ?? {};
    return {
      address: String(wr['address'] ?? ''),
      chainId: num(wr['chainId']) ?? 0,
      primary: Boolean(wr['isPrimary'] ?? wr['primary']),
    };
  });
  const primary = str(r['walletAddress'])?.toLowerCase();
  return {
    id: String(r['id'] ?? ''),
    email: String(r['email'] ?? ''),
    displayName: str(r['displayName']) ?? null,
    firstName: str(r['firstName']) ?? null,
    lastName: str(r['lastName']) ?? null,
    country: str(r['country']) ?? null,
    walletAddress: str(r['walletAddress']) ?? null,
    // The server marks the primary via `walletAddress`; mirror it on the entry.
    wallets: wallets.map(w => ({
      ...w,
      primary: w.primary || w.address.toLowerCase() === primary,
    })),
    twoFactorEnabled: Boolean(r['twoFactorEnabled']),
    termsAcceptedAt: str(r['termsAcceptedAt']) ?? null,
    privacyAcceptedAt: str(r['privacyAcceptedAt']) ?? null,
    createdAt: str(r['createdAt']) ?? '',
  };
}

// Discovery -------------------------------------------------------------------

export function toAsset(raw: Row): Asset {
  return {
    // The API uses the contract address as the asset id.
    id: String(raw['id'] ?? raw['contractAddress'] ?? '').toLowerCase(),
    symbol: String(raw['symbol'] ?? ''),
    name: String(raw['name'] ?? ''),
    chainId: num(raw['chainId']) ?? 0,
    contractAddress: String(raw['contractAddress'] ?? ''),
    decimals: num(raw['decimals']) ?? 18,
    oracleStatus:
      raw['oracleStatus'] === 'accepted' || raw['oracleStatus'] === 'stale'
        ? raw['oracleStatus']
        : 'unavailable',
    tradable: Boolean(raw['tradable']),
    mode: raw['mode'] === 'zap' ? 'zap' : 'in-kind',
    underlyingTransferPolicy:
      raw['underlyingTransferPolicy'] === 'issuer_allowlist' ||
      raw['underlyingTransferPolicy'] === 'venue_gated' ||
      raw['underlyingTransferPolicy'] === 'open'
        ? raw['underlyingTransferPolicy']
        : 'unknown',
  };
}

export function listAssetsOf(body: unknown): Asset[] {
  return items(body, toAsset);
}

export function toDtf(raw: Row): Dtf {
  const fees = obj(raw['fees']) ?? {};
  const baseDecimals = num(raw['baseAssetDecimals']) ?? 18;
  const minInvestmentRaw = str(raw['minInvestmentRaw']);
  const lifecycle = str(raw['lifecycle']);
  return {
    id: String(raw['id'] ?? raw['contractAddress'] ?? ''),
    chainId: num(raw['chainId']) ?? 0,
    name: String(raw['name'] ?? ''),
    symbol: String(raw['symbol'] ?? ''),
    manager: String(raw['manager'] ?? ''),
    contractAddress: str(raw['contractAddress']),
    baseAssetId: String(raw['baseAssetId'] ?? ''),
    baseAssetDecimals: baseDecimals,
    shareDecimals: num(raw['shareDecimals']) ?? 18,
    weights: arr(raw['weights']).map(w => ({
      assetId: String(w['assetId'] ?? '').toLowerCase(),
      weightBps: num(w['weightBps']) ?? 0,
    })),
    nav: String(raw['nav'] ?? '0'),
    sharePrice: String(raw['sharePrice'] ?? '0'),
    aum: String(raw['aum'] ?? '0'),
    fees: {
      entryBps: num(fees['entryBps']) ?? 0,
      exitBps: num(fees['exitBps']) ?? 0,
      managementBps: num(fees['managementBps']) ?? 0,
    },
    minInvestment: minInvestmentRaw
      ? fromRaw(minInvestmentRaw, baseDecimals)
      : null,
    minInvestmentRaw,
    strategy: raw['strategyType']
      ? { type: String(raw['strategyType']) as StrategyType }
      : undefined,
    asOf: str(raw['asOf']) ?? str(raw['updatedAt']) ?? '',
    isPublished: lifecycle ? lifecycle !== 'coming_soon' : undefined,
    lifecycle,
  };
}

export function listDtfsOf(body: unknown): Dtf[] {
  return items(body, toDtf);
}

// Detail ----------------------------------------------------------------------

function availability(v: unknown): Availability {
  const s = obj(v)?.['status'];
  return s === 'available' ? 'available' : 'unavailable';
}

function toHolding(raw: Row): DtfHolding {
  return {
    assetId: String(raw['assetId'] ?? '').toLowerCase(),
    quantityRaw: String(raw['quantityRaw'] ?? raw['quantity'] ?? '0'),
    targetWeightBps: num(raw['targetWeightBps']) ?? null,
    actualWeightBps: num(raw['actualWeightBps']) ?? null,
    valuationStatus:
      raw['valuationStatus'] === 'accepted' ? 'accepted' : 'unavailable',
    asOf: str(raw['asOf']) ?? str(raw['observedAt']) ?? '',
  };
}

function toNavPoint(raw: Row): NavHistoryPoint {
  return {
    observedAt: str(raw['observedAt']) ?? '',
    navValue: String(raw['navValue'] ?? raw['nav'] ?? '0'),
    sharePrice: String(raw['sharePrice'] ?? '0'),
    totalSupplyRaw: String(raw['totalSupplyRaw'] ?? '0'),
    valuationStatus:
      raw['valuationStatus'] === 'accepted' ? 'accepted' : 'unavailable',
  };
}

function toDelta(raw: Row): PerformanceDelta {
  return {
    window: raw['window'] === 'inception' ? 'inception' : 'latest',
    fromObservedAt: str(raw['fromObservedAt']) ?? '',
    toObservedAt: str(raw['toObservedAt']) ?? '',
    sharePriceDelta: String(raw['sharePriceDelta'] ?? '0'),
    sharePriceDeltaBps: num(raw['sharePriceDeltaBps']) ?? 0,
  };
}

export function toTransaction(raw: Row): DtfTransaction {
  const status = str(raw['status']);
  return {
    id: String(raw['id'] ?? raw['txHash'] ?? ''),
    chainId: num(raw['chainId']) ?? 0,
    txHash: String(raw['txHash'] ?? ''),
    action: String(raw['action'] ?? ''),
    walletAddress: str(raw['walletAddress']) ?? null,
    assetId: str(raw['assetId'])?.toLowerCase() ?? null,
    amountRaw: str(raw['amountRaw']) ?? null,
    shareAmountRaw: str(raw['shareAmountRaw']) ?? null,
    status:
      status === 'confirmed' || status === 'pending' || status === 'reverted'
        ? status
        : 'confirmed',
    occurredAt: str(raw['occurredAt']) ?? str(raw['createdAt']) ?? '',
  };
}

function toCorporateAction(raw: Row): CorporateAction {
  const status = str(raw['status']);
  return {
    id: String(raw['id'] ?? ''),
    assetId: String(raw['assetId'] ?? '').toLowerCase(),
    actionType: String(raw['actionType'] ?? ''),
    effectiveAt: str(raw['effectiveAt']) ?? '',
    status:
      status === 'effective' || status === 'cancelled' ? status : 'announced',
    payload: raw['payload'],
  };
}

type Envelope = { status?: unknown; items?: unknown };

function readItems<T>(env: unknown, map: (row: Row) => T): T[] {
  const e = obj(env) as Envelope | undefined;
  return e?.status === 'available' ? arr(e.items).map(map) : [];
}

/** GET /dtfs/:id — the read models live under `readModels` as envelopes. */
export function toDtfDetail(raw: unknown): DtfDetail {
  const r = obj(raw) ?? {};
  const dtf = toDtf(r);
  const rm = obj(r['readModels']) ?? {};
  const detail: DtfDetail = {
    ...dtf,
    valuationStatus:
      r['valuationStatus'] === 'accepted' || r['valuationAvailable'] === true
        ? 'accepted'
        : 'unavailable',
    totalSupplyRaw: str(r['totalSupplyRaw']),
    priceStale: r['priceStale'] === true,
    priceSource: str(r['priceSource']),
    holdings: readItems(rm['holdings'], toHolding),
    performance: readItems(rm['performance'], toNavPoint),
    performanceDeltas: readItems(rm['performanceDeltas'], toDelta),
    recentTransactions: readItems(rm['recentTransactions'], toTransaction),
    corporateActions: readItems(rm['corporateActions'], toCorporateAction),
    readModels: {
      holdings: availability(rm['holdings']),
      performance: availability(rm['performance']),
      performanceDeltas: availability(rm['performanceDeltas']),
      recentTransactions: availability(rm['recentTransactions']),
      corporateActions: availability(rm['corporateActions']),
    },
  };
  return detail;
}

// Operations & trades ----------------------------------------------------------

export function toOperation(raw: unknown): Operation {
  const r = obj(raw) ?? {};
  return {
    id: String(r['id'] ?? ''),
    action: String(r['action'] ?? ''),
    status: String(r['status'] ?? ''),
    resourceId: str(r['resourceId']),
    walletAddress: str(r['walletAddress']),
    txHash: str(r['txHash']),
    createdAt: str(r['createdAt']),
    updatedAt: str(r['updatedAt']),
    submittedAt: str(r['submittedAt']),
    confirmedAt: str(r['confirmedAt']),
  };
}

/** `POST …/prepare` returns the draft plus `operation`; `requestId` is the op id. */
export function toTxDraft(raw: unknown): TxDraft {
  const r = obj(raw) ?? {};
  const tx = obj(r['transaction']) ?? {};
  const operation =
    r['operation'] !== undefined ? toOperation(r['operation']) : undefined;
  return {
    action: String(r['action'] ?? ''),
    requestId: String(r['requestId'] ?? operation?.id ?? ''),
    transaction: {
      to: String(tx['to'] ?? ''),
      data: String(tx['data'] ?? '0x') as TxDraft['transaction']['data'],
      value: String(tx['value'] ?? tx['nativeValueWei'] ?? '0'),
      chainId: num(tx['chainId']) ?? 0,
      gas: str(tx['gas']),
      nonce: str(tx['nonce']),
      maxFeePerGas: str(tx['maxFeePerGas']),
      maxPriorityFeePerGas: str(tx['maxPriorityFeePerGas']),
    },
    data: r['data'],
    operation,
    finalStep: typeof r['finalStep'] === 'boolean' ? r['finalStep'] : undefined,
  };
}

// Portfolio & eligibility ------------------------------------------------------

export function toWalletPortfolio(raw: unknown): WalletPortfolio {
  const r = obj(raw) ?? {};
  return {
    wallet: String(r['wallet'] ?? ''),
    positions: arr(r['positions']).map(p => ({
      dtfId: String(
        p['dtfId'] ?? p['portfolioId'] ?? p['contractAddress'] ?? '',
      ),
      shares: String(p['shares'] ?? p['shareBalanceRaw'] ?? '0'),
      value: String(p['value'] ?? p['valueBase'] ?? '0'),
      asOf: str(p['asOf']) ?? '',
    })),
  };
}

/** Normalize the didit-backed status payload into the app's eligibility view. */
export function toKyc(raw: unknown): KycStatusResponse {
  const r = obj(raw) ?? {};
  return {
    wallet: String(r['wallet'] ?? ''),
    provider: String(r['provider'] ?? 'didit'),
    status: String(r['status'] ?? 'Pending'),
    approved: Boolean(r['approved']),
    sessionId: str(r['sessionId']),
    attestationId: str(r['attestationId']),
    rawStatus: str(r['rawStatus']),
  };
}
