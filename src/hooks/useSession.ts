import { useContext } from 'react';

import { SessionContext, type SessionValue } from '../lib/sessionContext';

/** The session (user, onboarding stage, sign-in/out actions). */
export function useSession(): SessionValue {
  const value = useContext(SessionContext);
  if (!value) throw new Error('useSession must be used inside SessionProvider');
  return value;
}
