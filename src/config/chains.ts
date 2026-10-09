import { defineChain } from 'viem';

export const robinhoodTestnet = defineChain({
  id: 46630,
  name: 'Robinhood Chain Testnet',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ['https://rpc.testnet.chain.robinhood.com'],
    },
  },
});

/**
 * Local dev chain (Anvil, chain 31337). The RPC must be reachable by whatever
 * is running the app: `http://127.0.0.1:8545` works on the dev machine itself
 * (web / emulator), but a physical phone or a wallet app needs a tunnel —
 * set EXPO_PUBLIC_CHAIN_RPC_URL to an https URL (e.g. ngrok) in that case.
 */
export const localChain = defineChain({
  id: 31337,
  name: 'Local Anvil',
  nativeCurrency: {
    name: 'Ether',
    symbol: 'ETH',
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: [
        process.env.EXPO_PUBLIC_CHAIN_RPC_URL ?? 'http://127.0.0.1:8545',
      ],
    },
  },
});
