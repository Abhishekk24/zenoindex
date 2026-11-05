/**
 * Session state shape and context, shared by SessionProvider and the
 * useSession / useUser hooks.
 *
 * The signed-in user decides the onboarding stage:
 *
 *   null                          → signedOut
 *   terms or privacy not accepted → terms
 *   no first/last name            → profile
 *   otherwise                     → ready
 */
import { createContext } from 'react';

import type { User } from './types';

export type Stage = 'signedOut' | 'terms' | 'profile' | 'ready';

export type SessionValue = {
  user: User | null;
  stage: Stage;
  /** False until the first /auth/me answer (or failure) after app start. */
  booted: boolean;
  /** Records the account returned by sign-in or an onboarding step. */
  setUser: (user: User) => void;
  /** Re-fetches /auth/me (e.g. after wallet linking changes the account). */
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
};

export const SessionContext = createContext<SessionValue | null>(null);

export function stageOf(user: User | null): Stage {
  if (!user) return 'signedOut';
  if (!user.termsAcceptedAt || !user.privacyAcceptedAt) return 'terms';
  if (!user.firstName || !user.lastName) return 'profile';
  return 'ready';
}
