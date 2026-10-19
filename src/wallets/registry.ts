/**
 * External wallet apps offered in the wallet picker. Each opens the WalletConnect
 * pairing link in its own app (`<scheme>://wc?uri=…`); "Other wallet" hands the
 * raw `wc:` link to the system, which on Android lists every installed
 * WalletConnect wallet, so any wallet type can connect.
 *
 * Schemes must also be declared for "is it installed?" checks:
 * app.json → ios.infoPlist.LSApplicationQueriesSchemes, and
 * plugins/withWalletQueries.js for Android.
 *
 * Logos come from WalletConnect's wallet directory, bundled in assets/wallets.
 */
import type { ImageSourcePropType } from 'react-native';

export type WalletApp = {
  id: string;
  name: string;
  /** The app's logo; null for "Other wallet". */
  logo: ImageSourcePropType | null;
  /** Opens the app (also used to bring it back for each request). */
  scheme: string | null;
  /** The pairing link for this app. */
  pairLink: (wcUri: string) => string;
};

const deepLink =
  (scheme: string) =>
  (wcUri: string): string =>
    `${scheme}://wc?uri=${encodeURIComponent(wcUri)}`;

export const WALLET_APPS: WalletApp[] = [
  {
    id: 'metamask',
    logo: require('../../assets/wallets/metamask.png'),
    name: 'MetaMask',
    scheme: 'metamask',
    pairLink: deepLink('metamask'),
  },
  {
    id: 'trust',
    logo: require('../../assets/wallets/trust.png'),
    name: 'Trust Wallet',
    scheme: 'trust',
    pairLink: deepLink('trust'),
  },
  {
    id: 'rainbow',
    logo: require('../../assets/wallets/rainbow.png'),
    name: 'Rainbow',
    scheme: 'rainbow',
    pairLink: deepLink('rainbow'),
  },
  {
    id: 'coinbase',
    logo: require('../../assets/wallets/coinbase.png'),
    name: 'Coinbase Wallet',
    scheme: 'cbwallet',
    pairLink: deepLink('cbwallet'),
  },
  {
    id: 'zerion',
    logo: require('../../assets/wallets/zerion.png'),
    name: 'Zerion',
    scheme: 'zerion',
    pairLink: deepLink('zerion'),
  },
  {
    id: 'uniswap',
    logo: require('../../assets/wallets/uniswap.png'),
    name: 'Uniswap Wallet',
    scheme: 'uniswap',
    pairLink: deepLink('uniswap'),
  },
  {
    id: 'ledger',
    logo: require('../../assets/wallets/ledger.png'),
    name: 'Ledger Live',
    scheme: 'ledgerlive',
    pairLink: deepLink('ledgerlive'),
  },
];

/** Any other WalletConnect wallet: the system picks (or asks) which app opens it. */
export const OTHER_WALLET: WalletApp = {
  id: 'other',
  name: 'Other wallet',
  logo: null,
  scheme: null,
  pairLink: wcUri => wcUri,
};

export function walletApp(
  id: string | null | undefined,
): WalletApp | undefined {
  if (!id) return undefined;
  return id === OTHER_WALLET.id
    ? OTHER_WALLET
    : WALLET_APPS.find(app => app.id === id);
}
