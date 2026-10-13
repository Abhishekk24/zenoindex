import type { User } from './types';

/** The wallet that holds the user's shares: primary, then canonical, then first linked. */
export function primaryWallet(user: User): string | null {
  return (
    user.wallets.find(w => w.primary)?.address ??
    user.walletAddress ??
    user.wallets[0]?.address ??
    null
  );
}
