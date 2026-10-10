import { defineChain, type Address } from "viem";

/** zenoindex-evm commit the mainnet contracts (and src/abis.ts) were built from. Keep in sync with scripts/gen-abis.mjs. */
export const EVM_COMMIT = "7663cc6";

export const BPS = 10_000;
export const USDG_DECIMALS = 6;
export const SHARE_DECIMALS = 6;

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
