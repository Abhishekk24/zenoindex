/**
 * Who is signed in, and how far through onboarding they are. The root
 * layout (src/app/_layout.tsx) picks the auth or app routes from `stage`.
 *
 * On boot the persisted `dtf_session` cookie (SecureStore, see lib/http.ts)
 * is replayed against GET /auth/me; the returned user decides the stage:
 *
 *   null                          → signedOut
 *   terms or privacy not accepted → terms
 *   no first/last name            → profile
 *   otherwise                     → ready
 */
import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import * as api from './api';
import type { User } from './types';

export type Stage = 'signedOut' | 'terms' | 'profile' | 'ready';

type SessionValue = {
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

const SessionContext = createContext<SessionValue | null>(null);

function stageOf(user: User | null): Stage {
  if (!user) return 'signedOut';
  if (!user.termsAcceptedAt || !user.privacyAcceptedAt) return 'terms';
  if (!user.firstName || !user.lastName) return 'profile';
  return 'ready';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);

  useEffect(() => {
    let live = true;
    api
      .getMe()
      .then(found => {
        if (live) setUser(found);
      })
      .catch(() => {
        // Unreachable API on boot: keep the signed-out stage; screens retry.
      })
      .finally(() => {
        if (live) setBooted(true);
      });
    return () => {
      live = false;
    };
  }, []);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      stage: stageOf(user),
      booted,
      setUser,
      refresh: async () => {
        setUser(await api.getMe());
      },
      signOut: async () => {
        await api.signOut();
        setUser(null);
      },
    }),
    [user, booted],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}

export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}

/** The signed-in user; only for screens behind the `ready` stage. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser called while signed out');
  return user;
}
