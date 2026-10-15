import { defineChain, type Address } from "viem";

/**
 * zenoindex-evm commit src/abis.ts is built from (branch feat/zenoindex/phase-1-hardening). Keep in sync with
 * scripts/gen-abis.mjs. 550d0a2 only adds to 7663cc6 (what MAINNET below runs): FeeEscrow + the factory's
 * feeEscrow(), and AccessMaster's rebalance trading fee (tradingFeeBps).
 */
export const EVM_COMMIT = "550d0a2";

export const BPS = 10_000;
export const USDG_DECIMALS = 6;
export const SHARE_DECIMALS = 6;

// Vault.sol libraries/Constants.sol.
/** USDG (raw) that genesisDeposit pulls from the manager. */
export const GENESIS_SEED_USDC = 1_000_000n;
/** genesisDeposit's baseline share price is USDG per share scaled by 1e9 (PRICE_SCALE). */
export const BASELINE_PRICE_DECIMALS = 9;
/** executeRebalance is a no-op for a slot within this many bps of its target. */
export const REBALANCE_DRIFT_BPS = 50;
export const MAX_ASSETS = 20;
/** createVault fee bounds (Vault.init): entry ≤ 6%, exit 0.5%–10%. */
export const MAX_DEPOSIT_FEE_BPS = 600;
export const MIN_REDEEM_FEE_BPS = 50;
export const MAX_REDEEM_FEE_BPS = 1000;

export const robinhood = defineChain({
  id: 4663,
  name: "Robinhood Chain",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
  blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.mainnet.chain.robinhood.com" } },
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

/** Robinhood Chain mainnet deployment (zenoindex-evm broadcast/Deploy.s.sol/4663/run-latest.json). */
export const MAINNET = {
  chainId: 4663,
  factory: "0xd00abbc1d1555a173c5081b2204579b057b05378" as Address,
  accessMaster: "0x9e0d0f667307c8a3512caf5c50efeb0eddfbb78d" as Address,
  vaultImplementation: "0xe76f73be98f7002fc8b68466c5a8780d993f0115" as Address,
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as Address,
  deployBlock: 83_351_081n,
} as const;
