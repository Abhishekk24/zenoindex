/**
 * Create basket form (manager mode): its fields, choices, per-step checks and
 * the summary the Review step shows. Choices and rules follow the web form
 * (programmable-dtf-infra apps/dtf-app/components/create-basket-form.tsx).
 *
 * The assets come from GET /assets (each with its price); who may create,
 * the base asset and the limits from GET /manager/create; the transaction
 * from POST /manager/create/prepare → factory createVault. On-chain a basket has a
 * name, symbol, weights, an entry and an exit fee; the signer becomes its
 * manager. The strategy / dividend / minimum-investment choices below aren't
 * stored on-chain yet.
 */
import * as api from '../lib/api';
import type { TxDraft } from '../lib/types';
import { activeChain } from '../config/chains';

export type Option = { value: string; label: string };

export type CreateAsset = {
  id: string;
  name: string;
  symbol: string;
  /** 'zap' assets can be a basket's base asset (USDG). */
  mode: 'zap' | 'in-kind';
  logoUrl?: string | null;
};

/**
 * Who may create (and the limits), plus the assets a basket can hold: every
 * asset with a price — createVault reverts on one without. The list comes
 * from GET /assets, the same one the Assets tab shows.
 */
export async function loadCreateOptions() {
  const [options, all] = await Promise.all([
    api.getCreateOptions(),
    api.listAssets(),
  ]);
  const base = options.baseAssetId?.toLowerCase();
  const assets: CreateAsset[] = all
    .filter(a => a.priceUsdg !== null)
    .map(a => ({
      id: a.id,
      name: a.name,
      symbol: a.symbol,
      mode: a.id === base ? 'zap' : 'in-kind',
      logoUrl: a.logoUrl ?? null,
    }));
  console.log(
    `[create] ${assets.length} of ${all.length} assets priced: ${assets
      .map(a => a.symbol)
      .join(', ')}; base ${base}; canCreate ${options.canCreate}`,
  );
  return { ...options, assets };
}

export const CREATE_CHAINS: (Option & { providers: Option[] })[] = [
  {
    value: String(activeChain.id),
    label: activeChain.name,
    providers: [{ value: 'robinhood', label: 'Robinhood' }],
  },
];

export const REBALANCE_STRATEGIES: Option[] = [
  { value: 'WEIGHTAGE', label: 'Weightage' },
  { value: 'VOLATILITY', label: 'Volatility' },
  { value: 'MARKET_CAP', label: 'Market Cap' },
];
export const ALLOCATION_STRATEGIES: Option[] = [
  { value: 'TARGET_WEIGHT', label: 'Target Weight' },
];
export const EXECUTION_MODES: Option[] = [
  { value: 'MANAGER_APPROVAL', label: 'Manager Approval' },
  { value: 'AUTOMATIC', label: 'Automatic' },
];
export const REBALANCE_TRIGGERS: Option[] = [
  { value: 'MANUAL', label: 'Manual' },
  { value: 'THRESHOLD', label: 'Threshold' },
  { value: 'PERIODIC', label: 'Periodic' },
  { value: 'HYBRID', label: 'Hybrid' },
];
export const DIVIDEND_STRATEGIES: Option[] = [
  { value: 'reinvest', label: 'Reinvest' },
  { value: 'cash', label: 'Cash' },
];

export const STEPS = [
  'Identity',
  'Constituents',
  'Fees & Access',
  'Review',
  'Deploy',
  'Configure',
] as const;

export type Constituent = { assetId: string; weight: string };

export type CreateForm = {
  chain: string;
  provider: string;
  name: string;
  symbol: string;
  complianceScope: string;
  /** Local image picked for the basket (DTF Image); uploaded on create. */
  imageUri: string;
  baseAssetId: string;
  constituents: Constituent[];
  managementFee: string;
  entryFee: string;
  exitFee: string;
  managerWallet: string;
  minInvestment: string;
  rebalanceStrategy: string;
  feeRecipient: string;
  allocationStrategy: string;
  executionMode: string;
  rebalanceTrigger: string;
  dividendStrategy: string;
  corporateActions: boolean;
};

export const EMPTY_FORM: CreateForm = {
  // The configured network is preset for basket creation.
  chain: String(activeChain.id),
  provider: 'robinhood',
  name: '',
  symbol: '',
  complianceScope: '',
  imageUri: '',
  baseAssetId: '',
  constituents: [],
  managementFee: '',
  entryFee: '',
  exitFee: '',
  managerWallet: '',
  minInvestment: '',
  rebalanceStrategy: 'WEIGHTAGE',
  feeRecipient: '',
  allocationStrategy: 'TARGET_WEIGHT',
  executionMode: 'MANAGER_APPROVAL',
  rebalanceTrigger: 'MANUAL',
  dividendStrategy: 'reinvest',
  corporateActions: false,
};

export function labelOf(options: Option[], value: string): string {
  return options.find(o => o.value === value)?.label ?? '—';
}

export function assetOf(
  id: string,
  assets: CreateAsset[],
): CreateAsset | undefined {
  return assets.find(a => a.id === id);
}

export function providersOf(chain: string): Option[] {
  return CREATE_CHAINS.find(c => c.value === chain)?.providers ?? [];
}

const num = (v: string) => (v.trim() === '' ? NaN : Number(v));

/** Sum of the constituents' weights, in percent. */
export function totalWeight(form: CreateForm): number {
  return form.constituents.reduce((sum, c) => {
    const w = Number(c.weight);
    return sum + (Number.isFinite(w) ? w : 0);
  }, 0);
}

const ADDRESS = /^0x[0-9a-fA-F]{40}$/;
const inRange = (v: string, min: number, max: number) => {
  const n = num(v);
  return Number.isFinite(n) && n >= min && n <= max;
};

/** Field errors for one step (index into STEPS); empty when it can continue. */
export function stepErrors(
  form: CreateForm,
  step: number,
): Partial<Record<keyof CreateForm, string>> {
  const e: Partial<Record<keyof CreateForm, string>> = {};
  switch (step) {
    case 0:
      if (!form.name.trim()) e.name = 'Enter a basket name.';
      if (!/^[A-Z0-9]{2,11}$/.test(form.symbol.trim().toUpperCase()))
        e.symbol = 'Use 2–11 letters or numbers.';
      break;
    case 1: {
      if (!form.baseAssetId) e.baseAssetId = 'Choose a base asset.';
      if (form.constituents.length < 2)
        e.constituents = 'Add at least 2 constituents to create a DTF.';
      else if (Math.abs(totalWeight(form) - 100) > 0.001)
        e.constituents = 'Weights must total 100.00%.';
      break;
    }
    case 2:
      // The contract's bounds (Vault.init): entry 0–6%, exit 0.5–10%.
      if (!inRange(form.entryFee, 0, 6))
        e.entryFee = 'Enter an entry fee between 0 and 6%.';
      if (!inRange(form.exitFee, 0.5, 10))
        e.exitFee = 'Enter an exit fee between 0.5 and 10%.';
      if (form.feeRecipient.trim() && !ADDRESS.test(form.feeRecipient.trim()))
        e.feeRecipient = 'Must be a 0x address.';
      if (
        form.minInvestment.trim() &&
        !(
          Number.isFinite(num(form.minInvestment)) &&
          num(form.minInvestment) >= 0
        )
      )
        e.minInvestment = 'Must be a non-negative amount.';
      break;
  }
  return e;
}

export const pct = (v: string) =>
  Number.isFinite(num(v)) ? `${num(v).toFixed(2)}%` : '—';

export type CreationDraft = {
  operation: string;
  status: string;
  to: string;
  chainId: number;
  calldata: string;
  /** What Submit signs and sends. */
  tx: TxDraft;
};

/** Percent strings (summing to 100) → bps summing to exactly 10_000. */
export function weightsBps(form: CreateForm) {
  const weights = form.constituents.map(c => ({
    assetId: c.assetId,
    weightBps: Math.round(Number(c.weight) * 100),
  }));
  const drift = 10_000 - weights.reduce((sum, w) => sum + w.weightBps, 0);
  if (weights.length && drift !== 0)
    weights[weights.length - 1]!.weightBps += drift;
  return weights;
}

const bps = (percent: string) => Math.round(Number(percent) * 100);

/** POST /manager/create/prepare: the createVault transaction for this form. */
export async function prepareCreation(
  form: CreateForm,
): Promise<CreationDraft> {
  const tx = await api.prepareCreateBasket(Number(form.chain), {
    name: form.name.trim(),
    symbol: form.symbol.trim().toUpperCase(),
    weights: weightsBps(form),
    entryFeeBps: bps(form.entryFee),
    exitFeeBps: bps(form.exitFee),
    ...(form.feeRecipient.trim()
      ? { feeRecipient: form.feeRecipient.trim() }
      : {}),
  });
  return {
    operation: tx.requestId,
    status: tx.operation?.status ?? 'draft_prepared',
    to: tx.transaction.to,
    chainId: tx.transaction.chainId,
    calldata: tx.transaction.data,
    tx,
  };
}
