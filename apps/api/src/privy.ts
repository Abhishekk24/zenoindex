// Privy (https://docs.privy.io): the mobile app signs users in with an email code, Google, or an external wallet (Privy's SIWE).
// Email / Google users get an embedded Ethereum wallet. POST /auth/privy trades a verified Privy access token for a session
// on the user's wallet.
import { PrivyClient } from "@privy-io/node";
import { getAddress, type Address } from "viem";

export type PrivyAuth = {
  /** null: the token is invalid or expired. `wallet: null`: valid user whose embedded wallet isn't created yet. */
  walletOf(accessToken: string): Promise<{ wallet: Address | null } | null>;
};

type LinkedAccount = { type: string; chain_type?: string; connector_type?: string; address?: string; wallet_index?: number };

/**
 * The wallet that is the user's account: the embedded wallet when they have one (email / Google), otherwise the external
 * wallet they signed in with (Privy verified its SIWE signature). Embedded first, so linking a wallet later never moves an
 * email user to another account.
 */
export function accountWallet(linked: LinkedAccount[]): Address | null {
  const ethereum = linked.filter((a) => a.type === "wallet" && a.chain_type === "ethereum" && a.address);
  const embedded = ethereum.filter((a) => a.connector_type === "embedded").sort((a, b) => (a.wallet_index ?? 0) - (b.wallet_index ?? 0));
  const wallet = embedded[0] ?? ethereum.find((a) => a.connector_type !== "embedded");
  return wallet ? getAddress(wallet.address!) : null;
}

export function privyAuth(appId: string, appSecret: string): PrivyAuth {
  const client = new PrivyClient({ appId, appSecret });
  return {
    async walletOf(accessToken) {
      // Checks signature, expiry, issuer and that the token was issued for this app.
      const claims = await client.utils().auth().verifyAccessToken(accessToken).catch(() => null);
      if (!claims) return null;
      // The user's wallets come from Privy's API (needs the app secret), never from the client.
      const user = await client.users()._get(claims.user_id);
      return { wallet: accountWallet(user.linked_accounts as LinkedAccount[]) };
    },
  };
}
