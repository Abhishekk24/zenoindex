/**
 * Who is signed in, and how far through onboarding they are. The root
 * navigator picks the auth or app screens from `stage`.
 *
 * Held in memory only for now: the session token (and where it is stored on
 * the device) is decided when the app is connected to the web app's API.
 */
import React, { createContext, useContext, useMemo, useState } from 'react';

import * as api from './api';
import type { User } from './types';

export type Stage = 'signedOut' | 'terms' | 'profile' | 'ready';

type SessionValue = {
  user: User | null;
  stage: Stage;
  /** Records the account returned by sign-in or an onboarding step. */
  setUser: (user: User) => void;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<SessionValue | null>(null);

function stageOf(user: User | null): Stage {
  if (!user) return 'signedOut';
  if (!user.termsAcceptedAt) return 'terms';
  if (!user.profileCompletedAt) return 'profile';
  return 'ready';
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);

  const value = useMemo<SessionValue>(
    () => ({
      user,
      stage: stageOf(user),
      setUser,
      signOut: async () => {
        await api.signOut();
        setUser(null);
      },
    }),
    [user],
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
