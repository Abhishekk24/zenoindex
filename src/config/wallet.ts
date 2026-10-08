import '@walletconnect/react-native-compat';

import { createAppKit } from '@reown/appkit-react-native';
import { WagmiAdapter } from '@reown/appkit-wagmi-react-native';

import { localChain, robinhoodTestnet } from './chains';
import { appKitStorage } from './storage';

const projectId = process.env.EXPO_PUBLIC_REOWN_PROJECT_ID;

if (!projectId) {
  throw new Error('Missing EXPO_PUBLIC_REOWN_PROJECT_ID');
}

const wagmiAdapter = new WagmiAdapter({
  projectId,
  networks: process.env.EXPO_PUBLIC_CHAIN_RPC_URL
    ? [localChain, robinhoodTestnet]
    : [robinhoodTestnet],
});

const robinhoodNetwork = {
  ...robinhoodTestnet,
  chainNamespace: 'eip155' as const,
  caipNetworkId: `eip155:${robinhoodTestnet.id}` as const,
  testnet: true,
};

const localNetwork = {
  ...localChain,
  chainNamespace: 'eip155' as const,
  caipNetworkId: `eip155:${localChain.id}` as const,
  testnet: true,
};

// The local chain is only advertised when a chain RPC is explicitly
// configured — production builds are identical to single-network setup.
const useLocalChain = Boolean(process.env.EXPO_PUBLIC_CHAIN_RPC_URL);
const appNetworks = useLocalChain
  ? [localNetwork, robinhoodNetwork]
  : [robinhoodNetwork];

export const appKit = createAppKit({
  projectId,
  metadata: {
    name: 'Zeno',
    description: 'Zeno mobile investor app',
    url: 'http://localhost:8081',
    icons: [],
    redirect: {
      native: 'zeno://',
    },
  },
  adapters: [wagmiAdapter],
  networks: appNetworks,
  storage: appKitStorage,
  defaultNetwork: useLocalChain ? localNetwork : robinhoodNetwork,
  features: {
    socials: false,
  },
});

export { wagmiAdapter };
