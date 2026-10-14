/**
 * Who is signed in, and how far through onboarding they are.
 *
 * On boot the persisted `dtf_session` cookie (SecureStore, see lib/http.ts)
 * is replayed against GET /auth/me; the returned user decides the stage
 * (see stageOf in lib/sessionContext.ts). Read it with hooks/useSession.
 */
import { usePrivy } from '@privy-io/expo';
import React, { useEffect, useMemo, useState } from 'react';

import * as api from './api';
import { setSessionExpiredHandler } from './http';
import { SessionContext, type SessionValue, stageOf } from './sessionContext';
import type { User } from './types';

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [booted, setBooted] = useState(false);
  const { logout: privyLogout } = usePrivy();

  // An expired session anywhere in the app returns the user to sign-in.
  useEffect(() => setSessionExpiredHandler(() => setUser(null)), []);

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
        // Privy too, or the sign-in screen would resume its session.
        await Promise.all([api.signOut(), privyLogout().catch(() => {})]);
        setUser(null);
      },
    }),
    [user, booted, privyLogout],
  );

  return (
    <SessionContext.Provider value={value}>{children}</SessionContext.Provider>
  );
}
