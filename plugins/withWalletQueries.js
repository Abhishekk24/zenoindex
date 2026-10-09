/**
 * Android 11+ hides other apps unless the manifest declares them in <queries>.
 * Without this, AppKit can't detect or open installed wallets (it falls back to
 * a QR code / "get the app"). Adds common EVM wallet packages and WalletConnect
 * `wc:` links, merged into any <queries> already present.
 *
 * iOS needs the matching schemes in app.json → ios.infoPlist.LSApplicationQueriesSchemes.
 */
const {
  withAndroidManifest,
  createRunOncePlugin,
} = require('expo/config-plugins');

const WALLET_PACKAGES = [
  'io.metamask', // MetaMask
  'com.wallet.crypto.trustapp', // Trust Wallet
  'me.rainbow', // Rainbow
  'org.toshi', // Coinbase Wallet
  'com.okinc.okex.gp', // OKX Wallet
  'io.zerion.android', // Zerion
  'com.uniswap.mobile', // Uniswap Wallet
  'com.debank.rabbymobile', // Rabby
  'app.phantom', // Phantom (EVM too)
  'com.ledger.live', // Ledger Live
  'exodusmovement.exodus', // Exodus
  'im.token.app', // imToken
];

const asArray = value =>
  value ? (Array.isArray(value) ? value : [value]) : [];

function withWalletQueries(config) {
  return withAndroidManifest(config, config => {
    const manifest = config.modResults.manifest;
    const queries = manifest.queries?.[0] ?? {};

    const packages = asArray(queries.package);
    const known = new Set(packages.map(p => p?.$?.['android:name']));
    for (const name of WALLET_PACKAGES) {
      if (!known.has(name)) packages.push({ $: { 'android:name': name } });
    }

    const intents = asArray(queries.intent);
    const hasWc = intents.some(intent =>
      asArray(intent.data).some(d => d?.$?.['android:scheme'] === 'wc'),
    );
    if (!hasWc) {
      intents.push({
        action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }],
        data: [{ $: { 'android:scheme': 'wc' } }],
      });
    }

    manifest.queries = [{ ...queries, package: packages, intent: intents }];
    return config;
  });
}

module.exports = createRunOncePlugin(
  withWalletQueries,
  'withWalletQueries',
  '1.0.0',
);
