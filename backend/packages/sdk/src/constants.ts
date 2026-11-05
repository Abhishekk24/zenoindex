import { defineChain, type Address } from "viem";

/**
 * Deployed contract source revision (Chainlink price feeds) on
 * feat/zenoindex/phase-1-hardening. Keep in sync with scripts/gen-abis.mjs.
 */
export const EVM_COMMIT = "b284de1";

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

// One chain per API process. Robinhood remains the default.
const selectedChain = typeof process !== "undefined"
  ? process.env.ZENO_CHAIN
  : undefined;

const testnet = selectedChain === "testnet";

export const arcTestnet = defineChain({
  id: 5042002,
  name: "Arc Testnet",
  testnet: true,
  // Native USDC is 18-decimal at the EVM level (gas, eth_getBalance); the ERC-20 at 0x3600… is 6-decimal.
  nativeCurrency: { name: "USDC", symbol: "USDC", decimals: 18 },
  rpcUrls: { default: { http: ["https://rpc.testnet.arc.io"] } },
  blockExplorers: { default: { name: "Arc Explorer", url: "https://testnet.arcscan.app" } },
  // Every SDK read batches through multicall; without this viem throws on Arc.
  contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
});

export const robinhood = testnet
  ? defineChain({
      id: 46630,
      name: "Robinhood Chain Testnet",
      testnet: true,
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.testnet.chain.robinhood.com"] } },
      blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.testnet.chain.robinhood.com" } },
      contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
    })
  : defineChain({
      id: 4663,
      name: "Robinhood Chain",
      nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
      rpcUrls: { default: { http: ["https://rpc.mainnet.chain.robinhood.com"] } },
      blockExplorers: { default: { name: "Robinhood Explorer", url: "https://explorer.mainnet.chain.robinhood.com" } },
      contracts: { multicall3: { address: "0xcA11bde05977b3631167028862bE2a173976CA11" } },
    });

export const activeChain = selectedChain === "arc-testnet" ? arcTestnet : robinhood;

/** The deposit token baskets are priced in: USDG on Robinhood Chain, USDC on Arc. */
export const BASE_ASSET =
  selectedChain === "arc-testnet"
    ? ({ symbol: "USDC", name: "USD Coin" } as const)
    : ({ symbol: "USDG", name: "Global Dollar" } as const);

/** Testnet stand-ins (zenoindex-evm DeployTestnetMocks.s.sol + Deploy.s.sol, 2026-10-23). */
const TESTNET = {
  chainId: 46630,
  factory: "0x3bb34970bf3e1bc4a15f922cbc382b5b98f6cf87" as Address,
  accessMaster: "0xb681958bb29ab66b03e229d2f85819d10e2fac79" as Address,
  vaultImplementation: "0x7fa55ae5c7fd94b1aacfdbd6a5c1df8457fd66f7" as Address,
  feeEscrow: "0xa2dcbf0ff2131554a8c481c39e4e9154c2ccadfa" as Address,
  adapter: "0x7cd5378302af1086dba7c6e4d3610e63ef71f55c" as Address, // MockSwapRouter
  poolManager: "0x0000000000000000000000000000000000000000" as Address, // no V4 on testnet
  usdg: "0xb462642086474956f572bd5d9c5352f9ffe51548" as Address,
  deployBlock: 140_933_674n,
} as const;

/** Robinhood mainnet deployment with Chainlink price feeds (zenoindex-evm Deploy.s.sol + .env.mainnet, 2026-10-23). */
const ROBINHOOD_MAINNET = {
  chainId: 4663,
  factory: "0x21369835194f59e895636f92359de3c3241997ab" as Address,
  accessMaster: "0x7cd5378302af1086dba7c6e4d3610e63ef71f55c" as Address,
  vaultImplementation: "0xb462642086474956f572bd5d9c5352f9ffe51548" as Address,
  feeEscrow: "0x11e65932196b07617180a8fc5d1885bfd1170e9f" as Address,
  adapter: "0x1e19319e3479f13747b0d059079d8396d4ccf867" as Address,
  poolManager: "0x8366a39cc670b4001a1121b8f6a443a643e40951" as Address,
  usdg: "0x5fc5360d0400a0fd4f2af552add042d716f1d168" as Address,
  deployBlock: 95_473_628n,
} as const;

const ARC_TESTNET = {
  chainId: 5042002,
  factory: "0x50838499F82f13A527819b748d467CB7ba671E23" as Address,
  accessMaster: "0xEa5A7B27E511e831e1BfBb10F4B63Ea11077DB81" as Address,
  vaultImplementation: "0x0c840Ec559a06De4cA1fcCbc795C21844c421bDb" as Address,
  feeEscrow: "0x80BD86f5778C3cD3Dd55502cab55F4Ea96e87b36" as Address,
  adapter: "0x92c64e17a1A4c5B28a26B30102Ac1D453A7991b6" as Address,
  poolManager: "0x15b5f2c054b9dc788250131fcd1bcfcc34080a59" as Address,
  usdg: "0x3600000000000000000000000000000000000000" as Address,
  deployBlock: 70824974n,
} as const;

export const MAINNET = selectedChain === "arc-testnet"
  ? ARC_TESTNET
  : testnet ? TESTNET : ROBINHOOD_MAINNET;
