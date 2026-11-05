import type { User } from '../lib/types';
import { useSession } from './useSession';

/** The signed-in user; only for screens behind the `ready` stage. */
export function useUser(): User {
  const { user } = useSession();
  if (!user) throw new Error('useUser called while signed out');
  return user;
}
