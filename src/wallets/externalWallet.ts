/**
 * External wallets (MetaMask, Rainbow, Trust, … any WalletConnect wallet).
 * Privy's React Native SDK can't reach an external EVM wallet itself — its docs
 * point to WalletConnect for the signature — so WalletConnect's
 * UniversalProvider carries the requests and Privy only checks the signature.
 *
 * Rules, each from a failure seen on device:
 * - One client for the app's lifetime, kept on `globalThis` (Fast Refresh
 *   re-runs this file; extra clients answered requests they didn't send).
 * - Never disconnect before connecting: with no session left the relay socket
 *   goes idle and the new connect waits for it. An old session is closed only
 *   after the new one is approved.
 * - The relay socket is opened ahead of use (`warmUp`). Android drops it
 *   while Zeno is in the background; back after a while, it is reconnected at
 *   once rather than at WalletConnect's 35 s ping timeout.
 * - A request is never sent into a dropped socket ("Failed to publish
 *   payload"): after a while in the background it waits until Zeno is back in
 *   front, then sends and opens the wallet straight away. It is never sent
 *   twice — a second transaction could pay twice.
 * - The wallet app opens only once a request has reached the relay; opened
 *   sooner, Android pauses Zeno before it sends and the wallet shows nothing.
 * - The wallet's errors arrive as plain `{ code, message }` objects; they are
 *   turned into WalletErrors with a readable message.
 *
 * Expected times (besides the user's own taps): connect < 3 s from tapping a
 * wallet to its prompt and from returning to Zeno to "connected"; each request
 * the same. Waiting on the user gives up after 2 min.
 *
 * Every step is logged (`walletTrace`), in release builds too, so a device's
 * flow can be read with `adb logcat -s ReactNativeJS`.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import UniversalProvider from '@walletconnect/universal-provider';
import { useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import { getAddress, numberToHex, toHex, type Hex } from 'viem';
import { mainnet } from 'viem/chains';

import { robinhood } from '../config/chains';
import { WALLETCONNECT } from '../config/wallet';
import { launchWallet, openInWallet } from '../../modules/wallet-detector';
import { savedWalletApp, walletApp, type WalletApp } from './registry';
import { removeLegacyWalletData, walletStorage } from './storage';

const CHAINS = [mainnet, robinhood] as const;
const caip = (chainId: number) => `eip155:${chainId}`;

const NAMESPACES = {
  eip155: {
    chains: CHAINS.map(chain => caip(chain.id)),
    methods: [
      'eth_sendTransaction',
      'personal_sign',
      'eth_signTypedData_v4',
      'wallet_switchEthereumChain',
      'wallet_addEthereumChain',
    ],
    events: ['chainChanged', 'accountsChanged'],
    rpcMap: Object.fromEntries(
      CHAINS.map(chain => [String(chain.id), chain.rpcUrls.default.http[0]!]),
    ),
  },
};

/** Which wallet app the session belongs to, to open it for each request. */
const WALLET_APP_KEY = '@zeno/wallet-app';

/** How long the user has to approve a connection or answer a request. */
const WAIT_FOR_USER_MS = 2 * 60_000;
/**
 * Back in Zeno with a request still unanswered this long: the user left the
 * wallet without answering. It reopens by itself, once per request.
 */
const REOPEN_AFTER_MS = 4000;
/**
 * In the background longer than this, Android has likely dropped the relay
 * socket: reconnect on return, and hold requests until then.
 */
const SOCKET_STALE_MS = 15_000;
/**
 * The longest a request waits on the relay reconnecting before it is sent
 * anyway (WalletConnect connects on send itself). Its reconnect retries five
 * times, so waiting it out could hold a request — and the user — for minutes.
 */
const RELAY_WAIT_MS = 3000;
/**
 * A network switch opens the wallet only after this long unanswered: a wallet
 * already on the network (or switching without a prompt) answers first, and
 * the user isn't sent to it and back for nothing.
 */
const SWITCH_OPEN_AFTER_MS = 1500;

export const WALLET_SESSION_EXPIRED =
  'Your wallet connection expired. Connect your wallet again.';

/** WalletConnect's errors for a session the wallet no longer has. */
const STALE_SESSION =
  /recently deleted|No matching key|topic doesn't exist|Request expired|session.*(expired|deleted)/i;

// --- errors --------------------------------------------------------------------

/**
 * - rejected: the user said no in the wallet.
 * - cancelled: the user tapped Cancel in Zeno.
 * - timeout: no answer in time.
 * - expired: the wallet no longer has this session.
 * - not-installed: the wallet app couldn't be opened.
 * - offline: no internet.
 * - failed: anything else (the wallet's own message).
 */
export type WalletErrorKind =
  | 'rejected'
  | 'cancelled'
  | 'timeout'
  | 'expired'
  | 'not-installed'
  | 'offline'
  | 'failed';

export class WalletError extends Error {
  constructor(
    message: string,
    readonly kind: WalletErrorKind,
    /** The wallet's JSON-RPC code, e.g. 4001 rejected, 4902 unknown chain. */
    readonly code?: number,
  ) {
    super(message);
    this.name = 'WalletError';
  }
}

// --- state ---------------------------------------------------------------------

export type ExternalWalletState = {
  status: 'idle' | 'connecting' | 'connected';
  address?: Hex;
  /** The session's topic: which connection this is. */
  topic?: string;
  /** The wallet's current network, as it last reported it. */
  chainId?: number;
  app?: WalletApp;
  /** The connected wallet as it names itself (the session's peer). */
  peer?: { name: string; icon?: string };
  /**
   * The user came back to Zeno twice (the wallet was reopened once) and the
   * wallet still hasn't answered: likely closed by mistake. The UI asks.
   */
  stalled?: boolean;
};

type Shared = {
  state: ExternalWalletState;
  listeners: Set<() => void>;
  provider?: Promise<UniversalProvider>;
  /** Ends whatever is waiting on the user; see `cancelWalletRequest`. */
  waiting: Set<(e: WalletError) => void>;
  /** Bumped per connect; a superseded or cancelled one is ignored. */
  connectAttempt: number;
  cancelledAttempt?: number;
  /** The request the wallet was opened for and hasn't answered. */
  pending?: string;
  /** The pending connection or request the wallet was reopened for. */
  reopened?: string;
  /** When Zeno last went to the background (cleared when it's back). */
  backgroundSince?: number;
  /** The relay reconnect started on returning to Zeno, if any. */
  relayRefresh?: Promise<void>;
};
const shared: Shared = ((
  globalThis as { __zenoExternalWallet?: Shared }
).__zenoExternalWallet ??= {
  state: { status: 'idle' },
  listeners: new Set(),
  waiting: new Set(),
  connectAttempt: 0,
});

function set(next: ExternalWalletState) {
  shared.state = next;
  shared.listeners.forEach(listener => listener());
}

export function useExternalWallet(): ExternalWalletState {
  return useSyncExternalStore(
    listener => {
      shared.listeners.add(listener);
      return () => shared.listeners.delete(listener);
    },
    () => shared.state,
  );
}

export const externalWallet = () => shared.state;

/** "MetaMask", or "your wallet" for "Other wallet" / unknown. */
export const walletName = (app = shared.state.app) =>
  app && app.id !== 'other' ? app.name : 'your wallet';

let traceStart = 0;
/** "[wallet +4.2s] step"; `restart` starts a new timeline. */
export function walletTrace(step: string, restart = false): void {
  if (restart || !traceStart) traceStart = Date.now();
  const s = ((Date.now() - traceStart) / 1000).toFixed(1);
  console.log(`[wallet +${s}s] ${step}`);
}

/** "eip155:1:0xabc" → { chainId: 1, address } */
function parseAccount(account: string | undefined) {
  const [, chain, address] = account?.split(':') ?? [];
  if (!address) return {};
  return {
    address: getAddress(address) as Hex,
    chainId: chain ? Number(chain) : undefined,
  };
}

/** chainChanged data arrives as 1, "1", "0x1" or "eip155:1". */
function parseChain(value: unknown): number | undefined {
  const raw =
    String(value ?? '')
      .split(':')
      .pop() ?? '';
  const id = raw.startsWith('0x') ? parseInt(raw, 16) : Number(raw);
  return Number.isFinite(id) && id > 0 ? id : undefined;
}

/** Any error from the wallet, WalletConnect or our waiting, made readable. */
export function toWalletError(e: unknown, fallback: string): WalletError {
  if (e instanceof WalletError) return e;
  const raw = e as { message?: unknown; code?: unknown } | null | undefined;
  const text =
    typeof raw?.message === 'string'
      ? raw.message
      : typeof e === 'string'
        ? e
        : '';
  const code = typeof raw?.code === 'number' ? raw.code : undefined;
  // 4001: EIP-1193 user rejected; 5000: WalletConnect's "User rejected".
  if (code === 4001 || code === 5000 || /reject|denied|cancel/i.test(text)) {
    return new WalletError(`Cancelled in ${walletName()}.`, 'rejected', code);
  }
  if (STALE_SESSION.test(text)) {
    return new WalletError(WALLET_SESSION_EXPIRED, 'expired', code);
  }
  // The relay socket was dead when sending ("Failed to publish payload,
  // please try again. id:… tag:…").
  if (/failed to publish/i.test(text)) {
    return new WalletError(
      `Couldn’t send the request to ${walletName()}. Check your connection and try again.`,
      'failed',
      code,
    );
  }
  // WalletConnect: "No internet connection detected…"; fetch: "Network
  // request failed".
  if (/internet|offline|network request failed/i.test(text)) {
    return new WalletError(
      'You’re offline. Check your connection and try again.',
      'offline',
      code,
    );
  }
  return new WalletError(text || fallback, 'failed', code);
}

/** Waits for `work` until it settles, the user cancels, or `timeoutMessage`. */
function waitForUser<T>(work: Promise<T>, timeoutMessage: string): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const stop = (e: WalletError) => {
      done();
      reject(e);
    };
    const timer = setTimeout(
      () => stop(new WalletError(timeoutMessage, 'timeout')),
      WAIT_FOR_USER_MS,
    );
    const done = () => {
      clearTimeout(timer);
      shared.waiting.delete(stop);
    };
    shared.waiting.add(stop);
    work.then(
      value => {
        done();
        resolve(value);
      },
      e => {
        done();
        reject(e);
      },
    );
  });
}

/** The user tapped Cancel: whatever waits on the wallet ends now. */
export function cancelWalletRequest(): void {
  walletTrace('cancelled in Zeno');
  shared.cancelledAttempt = shared.connectAttempt;
  [...shared.waiting].forEach(stop =>
    stop(new WalletError('Cancelled.', 'cancelled')),
  );
}

// --- provider ------------------------------------------------------------------

/** The one WalletConnect provider, started at app launch (_layout.tsx). */
export function walletConnectProvider(): Promise<UniversalProvider> {
  shared.provider ??= init();
  return shared.provider;
}

/** Opens the relay socket if it's closed, so the next request goes at once. */
/** Closes and reopens the relay socket (one at a time). */
async function refreshRelay(
  relayer: UniversalProvider['client']['core']['relayer'],
): Promise<void> {
  if (relayer.connecting) return;
  walletTrace('reconnecting the relay');
  await relayer
    .restartTransport()
    .then(() => walletTrace('relay reconnected'))
    .catch(() => {});
}

/**
 * Resolves when a request can be sent: at once if Zeno is in front, or has
 * been in the background briefly with the socket up; otherwise once Zeno is
 * back in front and the relay reconnected.
 */
async function readyToSend(provider: UniversalProvider): Promise<void> {
  const relayer = provider.client.core.relayer;
  const away = Date.now() - (shared.backgroundSince ?? Date.now());
  const inBackground = AppState.currentState !== 'active';
  if (inBackground && (away > SOCKET_STALE_MS || !relayer.connected)) {
    walletTrace('Zeno in the background: sending once it is back');
    await new Promise<void>(resolve => {
      const sub = AppState.addEventListener('change', next => {
        if (next !== 'active') return;
        sub.remove();
        resolve();
      });
    });
  }
  await atMost(RELAY_WAIT_MS, shared.relayRefresh ?? Promise.resolve());
  await atMost(RELAY_WAIT_MS, warmUp());
}

/** Waits for `work`, but no longer than `ms`; never throws. */
function atMost(ms: number, work: Promise<unknown>): Promise<void> {
  return new Promise(resolve => {
    const timer = setTimeout(resolve, ms);
    work.then(
      () => {
        clearTimeout(timer);
        resolve();
      },
      () => {
        clearTimeout(timer);
        resolve();
      },
    );
  });
}

export async function warmUp(): Promise<void> {
  const provider = await walletConnectProvider();
  const relayer = provider.client.core.relayer;
  if (relayer.connected || relayer.connecting) return;
  walletTrace('relay closed: opening it');
  await relayer.transportOpen().catch(() => {});
}

async function init(): Promise<UniversalProvider> {
  walletTrace('WalletConnect starting', true);
  await removeLegacyWalletData();
  const provider = await UniversalProvider.init({
    projectId: WALLETCONNECT.projectId,
    metadata: WALLETCONNECT.metadata,
    storage: walletStorage,
  });
  walletTrace('WalletConnect started');

  const relayer = provider.client.core.relayer;
  relayer.on('relayer_connect', () => walletTrace('relay connected'));
  relayer.on('relayer_disconnect', () => walletTrace('relay disconnected'));
  relayer.on('relayer_message', () => walletTrace('relay message received'));

  AppState.addEventListener('change', next => {
    if (next === 'background') {
      walletTrace('left Zeno');
      shared.backgroundSince = Date.now();
      return;
    }
    if (next !== 'active') return;
    const away = Date.now() - (shared.backgroundSince ?? Date.now());
    shared.backgroundSince = undefined;
    walletTrace(`back in Zeno after ${(away / 1000).toFixed(1)}s`);
    // A socket idle in the background this long is likely dead even if it
    // still reports connected: reconnect now, so answers and requests flow.
    shared.relayRefresh =
      away > SOCKET_STALE_MS ? refreshRelay(relayer) : warmUp();
    // Still unanswered shortly after coming back: the user left the wallet
    // (another app, closed it by mistake). The first time the wallet reopens
    // by itself; the second time the user is asked (`stalled`).
    const id = shared.pending;
    if (id === undefined) return;
    setTimeout(() => {
      if (shared.pending !== id || AppState.currentState !== 'active') return;
      if (shared.reopened !== id) {
        shared.reopened = id;
        walletTrace('still no answer: reopening the wallet');
        void openWalletApp();
        return;
      }
      walletTrace('still no answer after reopening: asking the user');
      set({ ...shared.state, stalled: true });
    }, REOPEN_AFTER_MS);
  });

  const onGone = ({ topic }: { topic?: string }) => {
    if (!topic || topic === shared.state.topic) set({ status: 'idle' });
  };
  provider.on('session_delete', onGone);
  provider.on('session_expire', onGone);
  // Raw wallet events: they arrive even for networks the session doesn't list.
  provider.on(
    'session_event',
    ({
      topic,
      params,
    }: {
      topic: string;
      params: { event: { name: string; data: unknown } };
    }) => {
      if (topic !== shared.state.topic) return;
      const { name, data } = params.event;
      if (name === 'chainChanged') {
        set({
          ...shared.state,
          chainId: parseChain(data) ?? shared.state.chainId,
        });
      } else if (name === 'accountsChanged' && Array.isArray(data) && data[0]) {
        const { address } = parseAccount(
          String(data[0]).includes(':')
            ? String(data[0])
            : `eip155:0:${data[0]}`,
        );
        if (address) set({ ...shared.state, address });
      }
    },
  );

  // A session saved from an earlier launch (used for trades; sign-in always
  // connects afresh).
  const session = provider.session;
  if (session) {
    const { address } = parseAccount(session.namespaces.eip155?.accounts[0]);
    const app = walletApp(await AsyncStorage.getItem(WALLET_APP_KEY));
    if (address) {
      set({
        status: 'connected',
        address,
        topic: session.topic,
        app,
        peer: peerOf(session),
      });
    }
  }
  return provider;
}

// --- connecting ------------------------------------------------------------------

type Session = NonNullable<Awaited<ReturnType<UniversalProvider['connect']>>>;

/** The wallet's own name and icon, as the session reports them. */
function peerOf(session: {
  peer?: { metadata?: { name?: string; icons?: string[] } };
}): ExternalWalletState['peer'] {
  const name = session.peer?.metadata?.name?.trim();
  if (!name) return undefined;
  const icon = session.peer?.metadata?.icons?.find(i => /^https?:\/\//.test(i));
  return { name, ...(icon ? { icon } : {}) };
}

/** Opens `link` in the wallet: the exact app when its package is known. */
async function openInApp(app: WalletApp, link: string): Promise<void> {
  if (app.packageName && (await openInWallet(link, app.packageName))) return;
  await Linking.openURL(link);
}

/** Makes an approved session the connected wallet; closes the one before it. */
async function adopt(
  provider: UniversalProvider,
  session: Session,
  app: WalletApp,
): Promise<Hex> {
  const { address, chainId } = parseAccount(
    session.namespaces.eip155?.accounts[0],
  );
  if (!address) {
    throw new WalletError(
      `${walletName(app)} didn’t share an account.`,
      'failed',
    );
  }
  const previous = shared.state.topic;
  await AsyncStorage.setItem(
    WALLET_APP_KEY,
    JSON.stringify(savedWalletApp(app)),
  ).catch(() => {});
  set({
    status: 'connected',
    address,
    topic: session.topic,
    chainId,
    app,
    peer: peerOf(session),
  });
  if (previous && previous !== session.topic) {
    // In the background: nothing waits on it.
    void provider.client
      .disconnect({
        topic: previous,
        reason: { code: 6000, message: 'User disconnected.' },
      })
      .catch(() => {});
  }
  return address;
}

/**
 * Connects the chosen wallet app: sends the connection request, opens the app
 * on it, and waits for the user to approve. Resolves with the address.
 */
export async function connectWallet(app: WalletApp): Promise<Hex> {
  walletTrace(`connect ${app.name}`, true);
  const attempt = ++shared.connectAttempt;
  const provider = await walletConnectProvider();
  const stopped = () =>
    attempt !== shared.connectAttempt || shared.cancelledAttempt === attempt;
  if (stopped()) throw new WalletError('Cancelled.', 'cancelled');
  const previous = shared.state;
  set({ ...previous, status: 'connecting', app });

  // The proposal is on the relay when this fires: open the wallet on it.
  const onUri = (uri: string) => {
    if (stopped()) return;
    walletTrace('connection request sent: opening the wallet');
    shared.pending = `connect-${attempt}`;
    openInApp(app, app.pairLink(uri)).catch(() => {
      [...shared.waiting].forEach(stop =>
        stop(
          new WalletError(
            `${walletName(app)} isn’t installed.`,
            'not-installed',
          ),
        ),
      );
    });
  };
  provider.on('display_uri', onUri);
  const approval = provider.connect({ optionalNamespaces: NAMESPACES });
  try {
    const session = await waitForUser(
      approval,
      `No answer from ${walletName(app)}. Try connecting again.`,
    );
    if (!session) throw new WalletError('The wallet didn’t connect.', 'failed');
    walletTrace('connection approved');
    return await adopt(provider, session, app);
  } catch (e) {
    const error = toWalletError(e, 'The wallet didn’t connect.');
    walletTrace(`connect: ${error.kind} (${error.message})`);
    if (attempt === shared.connectAttempt) {
      // Back to whatever was connected before (if anything).
      set(previous.status === 'connected' ? previous : { status: 'idle' });
    }
    if (error.kind === 'cancelled' || error.kind === 'timeout') {
      // Approved in the wallet after Zeno stopped waiting: keep it, unless a
      // newer connect started; otherwise close it.
      approval.then(
        late => {
          if (!late) return;
          if (attempt === shared.connectAttempt) {
            walletTrace('approved after cancel: keeping the connection');
            void adopt(provider, late, app).catch(() => {});
          } else {
            void provider.client
              .disconnect({
                topic: late.topic,
                reason: { code: 6000, message: 'User disconnected.' },
              })
              .catch(() => {});
          }
        },
        () => {},
      );
    }
    throw error;
  } finally {
    provider.off('display_uri', onUri);
    endPending(`connect-${attempt}`);
  }
}

/** The pending connection or request `id` is over (answered or not). */
function endPending(id: string) {
  if (shared.pending !== id) return;
  shared.pending = undefined;
  if (shared.state.stalled) set({ ...shared.state, stalled: false });
}

export async function disconnectWallet(): Promise<void> {
  const provider = await walletConnectProvider();
  const topic = shared.state.topic;
  set({ status: 'idle' });
  await AsyncStorage.removeItem(WALLET_APP_KEY).catch(() => {});
  if (topic) {
    await provider.client
      .disconnect({
        topic,
        reason: { code: 6000, message: 'User disconnected.' },
      })
      .catch(() => {});
  }
}

// --- requests ------------------------------------------------------------------

/** Brings the connected wallet app to the front ("Other wallet" can't be). */
export async function openWalletApp(): Promise<void> {
  const app = shared.state.app;
  if (app?.packageName && (await launchWallet(app.packageName))) return;
  if (app?.scheme) await Linking.openURL(`${app.scheme}://`).catch(() => {});
}

/**
 * The networks the session on `topic` approved. Read from the client by
 * topic: UniversalProvider's own `session` can be another (older) one.
 */
function approvedChains(provider: UniversalProvider, topic: string): number[] {
  let ns;
  try {
    ns = provider.client.session.get(topic).namespaces.eip155;
  } catch {
    return [];
  }
  return [
    ...new Set(
      [
        ...(ns?.chains ?? []),
        ...(ns?.accounts ?? []).map(a => a.split(':').slice(0, 2).join(':')),
      ]
        .map(parseChain)
        .filter((id): id is number => id !== undefined),
    ),
  ];
}

/** `preferred` if approved, else a network the session did approve. */
function approvedChain(approved: number[], preferred: number): number {
  return approved.includes(preferred) ? preferred : (approved[0] ?? preferred);
}

/** A transaction request, short: where to, value, gas set, data size. */
function describeParams(method: string, params: unknown[]): string {
  if (method !== 'eth_sendTransaction') return '';
  const tx = (params[0] ?? {}) as {
    to?: string;
    value?: string;
    gas?: string;
    data?: string;
  };
  const bytes = tx.data ? (tx.data.length - 2) / 2 : 0;
  return `; tx to ${tx.to}, value ${tx.value ?? '0x0'}, gas ${tx.gas ?? 'unset'}, ${bytes} data bytes`;
}

/** An error exactly as it arrived (plain object, Error or nothing). */
function rawError(e: unknown): string {
  if (e === undefined) return 'undefined';
  try {
    return JSON.stringify(
      e,
      e instanceof Error ? Object.getOwnPropertyNames(e) : undefined,
    );
  } catch {
    return String(e);
  }
}

/**
 * Sends one request on the connected session, opens the wallet once it has
 * reached the relay, and waits for the answer. A failed request never
 * disconnects the wallet: only signing out does.
 */
async function walletRequest<T>(
  method: string,
  params: unknown[],
  chainId: number,
  /**
   * Opens the wallet only if it hasn't answered after this long. For requests
   * a wallet may answer without a prompt (a switch to the network it's on).
   */
  openAfterMs = 0,
): Promise<T> {
  const provider = await walletConnectProvider();
  const topic = shared.state.topic;
  if (shared.state.status !== 'connected' || !topic) {
    throw new WalletError(WALLET_SESSION_EXPIRED, 'expired');
  }
  const approved = approvedChains(provider, topic);
  const tag = caip(approvedChain(approved, chainId));
  walletTrace(
    `${method}: sending for chain ${chainId}, tagged ${tag}; session chains [${approved.join(', ')}]; wallet on ${shared.state.chainId ?? 'unknown'}${describeParams(method, params)}`,
  );
  await readyToSend(provider);

  const events = provider.client.events;
  let pendingId: string | undefined;
  const onSent = (e: {
    id: number;
    topic: string;
    request: { method: string };
  }) => {
    if (e.topic !== topic || e.request.method !== method) return;
    const id = `request-${e.id}`;
    const open = () => {
      if (shared.pending !== id) return; // answered meanwhile
      walletTrace(`${method}: opening the wallet`);
      void openWalletApp();
    };
    pendingId = id;
    shared.pending = id;
    walletTrace(`${method}: sent`);
    if (openAfterMs > 0) setTimeout(open, openAfterMs);
    else open();
  };
  events.on('session_request_sent', onSent);
  try {
    const result = await waitForUser(
      provider.client.request<T>({
        topic,
        chainId: tag,
        request: { method, params },
      }),
      `No answer from ${walletName()}. Try again.`,
    );
    walletTrace(`${method}: answered`);
    return result;
  } catch (e) {
    const error = toWalletError(
      e,
      `${walletName()} couldn’t complete the request.`,
    );
    walletTrace(
      `${method}: ${error.kind} (${error.message}); raw ${rawError(e)}`,
    );
    // Never disconnects here: only signing out does (session.tsx).
    throw error;
  } finally {
    events.off('session_request_sent', onSent);
    if (pendingId) endPending(pendingId);
  }
}

/**
 * Asks the wallet to move to `chainId` (transactions only; signing in doesn't
 * need it). The wallet shows its own "switch network" prompt, or "add network"
 * first if it doesn't know the chain.
 */
export async function switchChain(
  chainId: number,
  /**
   * Ask even if the wallet is believed to be on `chainId` (sign-in: the network
   * known from connecting is the first approved account's, not necessarily the
   * wallet's).
   */
  { always = false }: { always?: boolean } = {},
): Promise<void> {
  if (!always && shared.state.chainId === chainId) return;
  try {
    await walletRequest(
      'wallet_switchEthereumChain',
      [{ chainId: numberToHex(chainId) }],
      chainId,
      SWITCH_OPEN_AFTER_MS,
    );
  } catch (e) {
    const error = toWalletError(e, 'The network switch failed.');
    const unknownChain =
      error.code === 4902 ||
      /unrecognized|not added|unknown chain/i.test(error.message);
    const chain = CHAINS.find(c => c.id === chainId);
    if (!unknownChain || !chain) throw error;
    await walletRequest(
      'wallet_addEthereumChain',
      [
        {
          chainId: numberToHex(chain.id),
          chainName: chain.name,
          nativeCurrency: chain.nativeCurrency,
          rpcUrls: [chain.rpcUrls.default.http[0]],
          blockExplorerUrls: chain.blockExplorers
            ? [chain.blockExplorers.default.url]
            : undefined,
        },
      ],
      chainId,
    );
  }
  set({ ...shared.state, chainId });
}

/** personal_sign: a network-independent signature (sign-in messages). */
export function signMessage(message: string, address: Hex): Promise<Hex> {
  return walletRequest<Hex>(
    'personal_sign',
    [toHex(message), address],
    shared.state.chainId ?? mainnet.id,
  );
}

export type WalletTx = {
  chainId: number;
  to: Hex;
  data: Hex;
  value?: bigint;
  gas?: bigint;
};

/** Switches the wallet to the transaction's network, then asks it to send. */
export async function sendTransaction(tx: WalletTx): Promise<Hex> {
  const address = shared.state.address;
  if (shared.state.status !== 'connected' || !address) {
    throw new WalletError(WALLET_SESSION_EXPIRED, 'expired');
  }
  try {
    await switchChain(tx.chainId);
  } catch (e) {
    const error = toWalletError(e, 'The network switch failed.');
    if (error.kind !== 'rejected') throw error;
    throw new WalletError(
      `Switch ${walletName()} to ${tx.chainId === robinhood.id ? 'Robinhood Chain' : 'the right network'} to continue.`,
      'rejected',
      error.code,
    );
  }
  return walletRequest<Hex>(
    'eth_sendTransaction',
    [
      {
        from: address,
        to: tx.to,
        data: tx.data,
        value: numberToHex(tx.value ?? 0n),
        ...(tx.gas ? { gas: numberToHex(tx.gas) } : {}),
      },
    ],
    tx.chainId,
  );
}
