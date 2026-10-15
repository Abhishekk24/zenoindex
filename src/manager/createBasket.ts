/**
 * Create basket form (manager mode): its fields, choices, per-step checks and
 * the summary the Review step shows. Choices and rules follow the web form
 * (programmable-dtf-infra apps/dtf-app/components/create-basket-form.tsx).
 *
 * SAMPLE OPTIONS AND PREPARE: the ZenoIndex API has no chains-and-providers,
 * asset catalogue for creation, or create/deploy endpoint yet. Swap
 * CREATE_CHAINS / CREATE_ASSETS / prepareCreation for API calls when they exist.
 */

export type Option = { value: string; label: string };

export type CreateAsset = {
  id: string;
  name: string;
  symbol: string;
  /** 'zap' assets can be a basket's base asset (USDG). */
  mode: 'zap' | 'in-kind';
};

export const CREATE_CHAINS: (Option & { providers: Option[] })[] = [
  {
    value: '4663',
    label: 'Robinhood Chain (sample)',
    providers: [{ value: 'robinhood', label: 'Robinhood' }],
  },
];

export const CREATE_ASSETS: CreateAsset[] = [
  { id: 'usdg', name: 'Global Dollar', symbol: 'USDG', mode: 'zap' },
  { id: 'tsla', name: 'Tesla', symbol: 'TSLA', mode: 'in-kind' },
  { id: 'amzn', name: 'Amazon', symbol: 'AMZN', mode: 'in-kind' },
  { id: 'nvda', name: 'Nvidia', symbol: 'NVDA', mode: 'in-kind' },
  { id: 'aapl', name: 'Apple', symbol: 'AAPL', mode: 'in-kind' },
  { id: 'msft', name: 'Microsoft', symbol: 'MSFT', mode: 'in-kind' },
  { id: 'googl', name: 'Alphabet', symbol: 'GOOGL', mode: 'in-kind' },
  { id: 'meta', name: 'Meta', symbol: 'META', mode: 'in-kind' },
  { id: 'spy', name: 'S&P 500 ETF', symbol: 'SPY', mode: 'in-kind' },
  { id: 'weth', name: 'Wrapped Ether', symbol: 'WETH', mode: 'in-kind' },
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
  'Select Provider',
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
  chain: '',
  provider: '',
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

export function assetOf(id: string): CreateAsset | undefined {
  return CREATE_ASSETS.find(a => a.id === id);
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
const isPercent = (v: string) => {
  const n = num(v);
  return Number.isFinite(n) && n >= 0 && n <= 100;
};

/** Field errors for one step (index into STEPS); empty when it can continue. */
export function stepErrors(
  form: CreateForm,
  step: number,
): Partial<Record<keyof CreateForm, string>> {
  const e: Partial<Record<keyof CreateForm, string>> = {};
  switch (step) {
    case 0:
      if (!form.chain) e.chain = 'Choose a chain.';
      if (!form.provider) e.provider = 'Choose a provider.';
      break;
    case 1:
      if (!form.name.trim()) e.name = 'Enter a basket name.';
      if (!/^[A-Z0-9]{2,11}$/.test(form.symbol.trim().toUpperCase()))
        e.symbol = 'Use 2–11 letters or numbers.';
      break;
    case 2: {
      if (!form.baseAssetId) e.baseAssetId = 'Choose a base asset.';
      if (form.constituents.length < 2)
        e.constituents = 'Add at least 2 constituents to create a DTF.';
      else if (Math.abs(totalWeight(form) - 100) > 0.001)
        e.constituents = 'Weights must total 100.00%.';
      break;
    }
    case 3:
      if (!isPercent(form.managementFee))
        e.managementFee = 'Enter a fee between 0 and 100.';
      if (!isPercent(form.entryFee))
        e.entryFee = 'Enter a fee between 0 and 100.';
      if (!isPercent(form.exitFee))
        e.exitFee = 'Enter a fee between 0 and 100.';
      if (form.managerWallet.trim() && !ADDRESS.test(form.managerWallet.trim()))
        e.managerWallet = 'Must be a 0x address.';
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
};

/** SAMPLE: what the create-prepare endpoint will return (design: Deploy). */
export async function prepareCreation(
  _form: CreateForm,
): Promise<CreationDraft> {
  await new Promise(resolve => setTimeout(resolve, 600));
  return {
    operation: `mock-op-${Date.now()}`,
    status: 'draft_prepared',
    to: '0x5F00000000000000000000000000000000000aa3',
    chainId: 31337,
    calldata:
      '0x8f000000000000000000000000000000000000000000000000000000000000000000',
  };
}
