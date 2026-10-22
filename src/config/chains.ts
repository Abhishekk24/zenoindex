import { defineChain } from 'viem';

// EXPO_PUBLIC_CHAIN=testnet builds an app that trades on Robinhood testnet (pair it with a testnet API).
const testnet = process.env.EXPO_PUBLIC_CHAIN === 'testnet';
const network = testnet ? 'testnet' : 'mainnet';

/** Robinhood Chain mainnet — where the ZenoIndex contracts live. */
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
