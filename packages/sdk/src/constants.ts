import { defineChain, type Address } from "viem";

/**
 * Deployed contract source revision, documented by README commit d3d51b5 on
 * feat/zenoindex/phase-1-hardening. Keep in sync with scripts/gen-abis.mjs.
 */
export const EVM_COMMIT = "e755a31";

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

/** Robinhood mainnet deployment documented in zenoindex-evm README@d3d51b5. */
export const MAINNET = {
  chainId: 4663,
  factory: "0x494ecbd1d8df35fb39ad5973ec0a1598adf26ea9" as Address,
  accessMaster: "0xc3a8ab91f9cc66d789b33fd61674991adef3edf2" as Address,
  vaultImplementation: "0xb78a139e2f316527a53673b5f093cee9566cd1a7" as Address,
  feeEscrow: "0x86867a40da338dfaf75b8fb1f65bc3cc9ca3b34f" as Address,
  adapter: "0x1cd3f47e7137761e4c1066273893fbe778bb2dd7" as Address,
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Address,
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as Address,
  deployBlock: 90_148_628n,
} as const;
