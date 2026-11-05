import { defineChain } from 'viem';

// EXPO_PUBLIC_CHAIN=testnet builds an app that trades on Robinhood testnet (pair it with a testnet API).
const selectedChain = process.env.EXPO_PUBLIC_CHAIN;
const testnet = selectedChain === 'testnet';
const network = testnet ? 'testnet' : 'mainnet';

/** Robinhood Chain mainnet â€” where the ZenoIndex contracts live. */
export const robinhood = defineChain({
  id: testnet ? 46630 : 4663,
  name: testnet ? 'Robinhood Chain Testnet' : 'Robinhood Chain',
  testnet,
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [`https://rpc.${network}.chain.robinhood.com`],
    },
  },
  blockExplorers: {
    default: {
      name: 'Robinhood Explorer',
      url: `https://explorer.${network}.chain.robinhood.com`,
    },
  },
  contracts: {
    multicall3: { address: '0xcA11bde05977b3631167028862bE2a173976CA11' },
  },
});


/** Arc Testnet — Zeno's Arc deployment. */
export const arcTestnet = defineChain({
  id: 5042002,
  name: 'Arc Testnet',
  testnet: true,
  nativeCurrency: {
    name: 'USDC',
    symbol: 'USDC',
    decimals: 6,
  },
  rpcUrls: {
    default: { http: ['https://rpc.testnet.arc.io'] },
  },
  blockExplorers: {
    default: {
      name: 'Arc Explorer',
      url: 'https://testnet.arcscan.app',
    },
  },
});

export const activeChain = selectedChain === 'arc-testnet'
  ? arcTestnet
  : robinhood;
