// Privy (https://docs.privy.io): the mobile app signs users in with an email code, Google, or an external wallet (Privy's SIWE).
// Email / Google users get an embedded Ethereum wallet. POST /auth/privy trades a verified Privy access token for a session
// on the user's wallet.
import { PrivyClient } from "@privy-io/node";
import { getAddress, type Address } from "viem";

export type PrivyAuth = {
  /**
   * null: the token is invalid or expired. `wallet: null`: valid user whose embedded wallet isn't created yet.
   * `email`: the address Privy verified (email code or Google), null for a wallet sign-in.
   */
  walletOf(accessToken: string): Promise<{ wallet: Address | null; email: string | null } | null>;
};

type LinkedAccount = {
  type: string;
  chain_type?: string;
  connector_type?: string;
  address?: string;
  wallet_index?: number;
  /** Set on OAuth accounts (google_oauth, …); an email account carries it as `address`. */
  email?: string;
};

/** The email Privy verified for this user: the email account, else the Google (or other OAuth) one. */
export function accountEmail(linked: LinkedAccount[]): string | null {
  const email = linked.find((a) => a.type === "email")?.address ?? linked.find((a) => a.type.endsWith("_oauth") && a.email)?.email;
  return email ? email.trim().toLowerCase() : null;
}

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

/** The Privy app a token says it was issued for (its unverified `aud`), only to log a mismatch. App IDs aren't secret. */
export function tokenAudience(token: string): string | undefined {
  try {
    const payload = JSON.parse(Buffer.from(token.split(".")[1] ?? "", "base64url").toString("utf8")) as { aud?: unknown };
    return typeof payload.aud === "string" ? payload.aud : undefined;
  } catch {
    return undefined;
  }
}

export function privyAuth(appId: string, appSecret: string): PrivyAuth {
  const client = new PrivyClient({ appId, appSecret });
  return {
    async walletOf(accessToken) {
      // Checks signature, expiry, issuer and that the token was issued for this app.
      const claims = await client
        .utils()
        .auth()
        .verifyAccessToken(accessToken)
        .catch((e: unknown) => {
          // Never logs the token. The SDK's reason is vague ("token is invalid"), so name a wrong PRIVY_APP_ID outright.
          const aud = tokenAudience(accessToken);
          const mismatch = aud && aud !== appId ? `; token is for Privy app ${aud} but PRIVY_APP_ID is ${appId}` : "";
          console.warn(`privy: access token rejected (${e instanceof Error ? e.message : String(e)}${mismatch})`);
          return null;
        });
      if (!claims) return null;
      // The user's wallets come from Privy's API (needs the app secret), never from the client.
      const user = await client.users()._get(claims.user_id);
      const linked = user.linked_accounts as LinkedAccount[];
      return { wallet: accountWallet(linked), email: accountEmail(linked) };
    },
  };
}
