const assert = require('node:assert/strict');
const { readFileSync } = require('node:fs');
const { join } = require('node:path');
const { test } = require('node:test');
const ts = require('typescript');
const viem = require('viem');

// Execute app code without initializing Expo native modules or real wallets.
function load(relativePath, dependencies = {}) {
  const source = readFileSync(join(__dirname, '..', relativePath), 'utf8');
  const { outputText } = ts.transpileModule(source, {
    compilerOptions: {
      module: ts.ModuleKind.CommonJS,
      target: ts.ScriptTarget.ES2022,
      esModuleInterop: true,
    },
  });
  const module = { exports: {} };
  new Function('require', 'module', 'exports', outputText)(
    name => {
      if (name in dependencies) return dependencies[name];
      throw new Error(`Unexpected dependency: ${name}`);
    },
    module,
    module.exports,
  );
  return module.exports;
}

test('AppKit keeps the direct Robinhood RPC and the installed SDK selects it', async () => {
  const { robinhood } = load('src/config/chains.ts', { viem });
  const envKeys = [
    'EXPO_PUBLIC_PRIVY_APP_ID',
    'EXPO_PUBLIC_PRIVY_CLIENT_ID',
    'EXPO_PUBLIC_REOWN_PROJECT_ID',
  ];
  const previous = envKeys.map(key => process.env[key]);
  envKeys.forEach(key => (process.env[key] = 'test'));
  let adapterNetworks;
  let appKitOptions;
  try {
    load('src/config/wallet.ts', {
      '@reown/appkit-react-native': {
        createAppKit: options => (appKitOptions = options),
      },
      'expo-constants': { appOwnership: 'expo' },
      'expo-linking': { createURL: () => 'exp://test/--/wc-return' },
      'viem/chains': require('viem/chains'),
      '../theme/tokens': { colors: { gold: '#gold' } },
      './chains': { robinhood },
      './storage': { appKitStorage: {} },
      './walletAdapter': {
        WalletAdapter: class {
          constructor({ networks }) {
            adapterNetworks = networks;
          }
        },
      },
    });
  } finally {
    envKeys.forEach((key, index) => {
      if (previous[index] === undefined) delete process.env[key];
      else process.env[key] = previous[index];
    });
  }
  const network = adapterNetworks.find(chain => chain.id === 4663);
  assert.deepEqual(network.rpcUrls, robinhood.rpcUrls);
  assert.equal(
    appKitOptions.networks.find(chain => chain.id === 4663),
    network,
  );

  // Exercise the installed SDK's transport selection, including its chain list.
  const common = load(
    'node_modules/@reown/appkit-common-react-native/src/utils/PresetsUtil.ts',
  );
  const { getTransport } = load(
    'node_modules/@reown/appkit-wagmi-react-native/src/utils/helpers.ts',
    {
      viem,
      '@reown/appkit-common-react-native': common,
    },
  );
  // The SDK also needs ConstantsUtil, even on custom chains.
  common.ConstantsUtil = {
    BLOCKCHAIN_API_RPC_URL: 'https://rpc.walletconnect.org',
  };
  const client = viem.createPublicClient({
    chain: network,
    transport: getTransport({ chainId: network.id, projectId: 'test' }),
  });
  assert.equal(client.transport.url, robinhood.rpcUrls.default.http[0]);
});

test('background balance failures are handled, preserve rejection for callers, and allow retry', async t => {
  const failure = new Error('Unable to resolve RPC host');
  let pending;
  const { WalletAdapter } = load('src/config/walletAdapter.ts', {
    '@reown/appkit-wagmi-react-native': {
      WagmiAdapter: class {
        getBalance() {
          return pending;
        }
      },
    },
  });
  const warning = t.mock.method(console, 'warn', () => {});
  const adapter = new WalletAdapter();
  const params = { network: { id: 4663 } };

  // Match AppKit's fire-and-forget call; an unhandled rejection fails node:test.
  pending = Promise.reject(failure);
  adapter.getBalance(params);
  await new Promise(resolve => setImmediate(resolve));
  assert.equal(warning.mock.calls.length, 1);

  pending = Promise.reject(failure);
  const result = adapter.getBalance(params);
  assert.equal(result, pending);
  await assert.rejects(result, error => error === failure);

  const balance = { amount: '1.25', symbol: 'ETH' };
  pending = Promise.resolve(balance);
  assert.equal(await adapter.getBalance(params), balance);
  assert.equal(warning.mock.calls.length, 2);
});
