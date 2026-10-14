/**
 * Investor or manager mode (Profile → Account → Manager Mode), remembered
 * across launches. A tiny store instead of a context, so any screen can read
 * it without a provider.
 *
 * Switching shows ModeSwitchOverlay for at least SWITCH_MIN_MS so the change
 * reads as a deliberate transition rather than a flicker.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useSyncExternalStore } from 'react';

export type AppMode = 'investor' | 'manager';

const STORAGE_KEY = '@zeno/app-mode';
const SWITCH_MIN_MS = 1200;

type State = {
  mode: AppMode;
  /** The mode being switched to while the overlay shows. */
  switchingTo: AppMode | null;
};

let state: State = { mode: 'investor', switchingTo: null };
const listeners = new Set<() => void>();

function set(next: Partial<State>) {
  state = { ...state, ...next };
  listeners.forEach(listener => listener());
}

// Restore the last mode; investor until it loads or if it can't be read.
AsyncStorage.getItem(STORAGE_KEY)
  .then(saved => {
    if (saved === 'manager' && state.switchingTo === null) {
      set({ mode: 'manager' });
    }
  })
  .catch(() => {});

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function useAppMode(): State {
  return useSyncExternalStore(subscribe, () => state);
}

/**
 * Switches mode behind the overlay.
 * TODO: load the manager's data here (behind the overlay) once the manager
 * screens exist; the overlay stays up until both this and SWITCH_MIN_MS end.
 */
export async function switchMode(to: AppMode): Promise<void> {
  if (state.switchingTo || state.mode === to) return;
  set({ switchingTo: to });
  await new Promise(resolve => setTimeout(resolve, SWITCH_MIN_MS));
  await AsyncStorage.setItem(STORAGE_KEY, to).catch(() => {});
  set({ mode: to, switchingTo: null });
}
