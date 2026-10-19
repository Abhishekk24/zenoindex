/**
 * External wallets (MetaMask, Rainbow, Trust, … any WalletConnect wallet) over
 * WalletConnect's UniversalProvider — the same layer Privy's web SDK uses, with
 * no Reown AppKit and no wagmi, so there is exactly one source of truth for the
 * connected wallet: this module's state.
 *
 * Every wallet request goes straight to the wallet over the session
 * (`client.request`). UniversalProvider's own `request` handles
 * wallet_switchEthereumChain locally for chains the session approved and never
 * asks the wallet — which left wallets on the wrong network.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import UniversalProvider from '@walletconnect/universal-provider';
import { useSyncExternalStore } from 'react';
import { AppState, Linking } from 'react-native';
import { getAddress, numberToHex, toHex, type Hex } from 'viem';
import { mainnet } from 'viem/chains';

import { robinhood } from '../config/chains';
import { WALLETCONNECT } from '../config/wallet';
import { walletApp, type WalletApp } from './registry';
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

/** Which wallet app the user picked, to bring it back for each request. */
const WALLET_APP_KEY = '@zeno/wallet-app';

export const WALLET_SESSION_EXPIRED =
  'Your wallet connection expired. Connect your wallet again.';

/** WalletConnect's errors for a session or request the wallet no longer has. */
const STALE_SESSION =
  /recently deleted|No matching key|topic doesn't exist|Request expired|session.*(expired|deleted)/i;

export type ExternalWalletState = {
  status: 'idle' | 'connecting' | 'connected';
  address?: Hex;
  /** The wallet's current network, as it last reported it (may be one we don't support). */
  chainId?: number;
  app?: WalletApp;
};

// --- state ---------------------------------------------------------------

let state: ExternalWalletState = { status: 'idle' };
const listeners = new Set<() => void>();

function set(next: ExternalWalletState) {
  state = next;
  listeners.forEach(listener => listener());
}

export function useExternalWallet(): ExternalWalletState {
  return useSyncExternalStore(
    listener => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    () => state,
  );
}

export const externalWallet = () => state;

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

// --- provider --------------------------------------------------------------

let providerPromise: Promise<UniversalProvider> | undefined;

/** The one WalletConnect provider; restores a saved session on first use. */
export function walletConnectProvider(): Promise<UniversalProvider> {
  providerPromise ??= init();
  return providerPromise;
}

async function init(): Promise<UniversalProvider> {
  await removeLegacyWalletData();
  const provider = await UniversalProvider.init({
    projectId: WALLETCONNECT.projectId,
    metadata: WALLETCONNECT.metadata,
    storage: walletStorage,
  });

  // Back from the wallet app: Android may drop the relay socket while Zeno is
  // in the background, and WalletConnect only notices at its ping timeout
  // (35 s) — it reconnects on network changes, not app ones. If the wallet's
  // answer hasn't arrived shortly after the user is back, the socket is dead:
  // reconnect then. Not at once: a live socket may be delivering the answer,
  // and a new one would deliver it a second time, which WalletConnect rejects
  // ("emitting session_request:… without any listeners").
  let wentBackground = false;
  AppState.addEventListener('change', next => {
    if (next === 'background') {
      wentBackground = true;
      walletTrace('left Zeno');
      return;
    }
    if (next !== 'active' || !wentBackground) return;
    wentBackground = false;
    walletTrace('back in Zeno');
    if (inFlight === 0) return;
    setTimeout(() => {
      if (inFlight === 0) return;
      walletTrace('no answer yet: reconnecting to the relay');
      void provider.client.core.relayer
        .restartTransport()
        .then(() => walletTrace('relay reconnected'))
        .catch(() => {});
    }, RECONNECT_AFTER_MS);
  });

  const reset = () => set({ status: 'idle' });
  provider.on('session_delete', reset);
  provider.on('session_expire', reset);
  provider.on('disconnect', reset);
  // Raw wallet events: they arrive even for networks the session doesn't list
  // (e.g. the wallet moved to Base), which the provider's own events drop.
  provider.on(
    'session_event',
    ({ params }: { params: { event: { name: string; data: unknown } } }) => {
      if (state.status !== 'connected') return;
      const { name, data } = params.event;
      if (name === 'chainChanged') {
        set({ ...state, chainId: parseChain(data) ?? state.chainId });
      } else if (name === 'accountsChanged' && Array.isArray(data) && data[0]) {
        const { address } = parseAccount(
          String(data[0]).includes(':')
            ? String(data[0])
            : `eip155:0:${data[0]}`,
        );
        if (address) set({ ...state, address });
      }
    },
  );

  // A session saved from an earlier launch.
  if (provider.session) {
    const { address } = parseAccount(
      provider.session.namespaces.eip155?.accounts[0],
    );
    const app = walletApp(await AsyncStorage.getItem(WALLET_APP_KEY));
    // The current network isn't known until the wallet reports it; requests
    // that need a network switch to it first.
    if (address) set({ status: 'connected', address, chainId: undefined, app });
  }
  return provider;
}

/** Wallet requests (or a connection) waiting on the wallet's answer. */
let inFlight = 0;

/** How long after returning to Zeno an unanswered request counts as stuck. */
const RECONNECT_AFTER_MS = 2000;

let traceStart = 0;
/**
 * Dev-only timing of the wallet flow, to see which step is slow:
 * "[wallet +4.2s] signature received". `restart` starts a new timeline.
 */
export function walletTrace(step: string, restart = false): void {
  if (!__DEV__) return;
  if (restart || !traceStart) traceStart = Date.now();
  const s = ((Date.now() - traceStart) / 1000).toFixed(1);
  console.log(`[wallet +${s}s] ${step}`);
}

// --- connecting ------------------------------------------------------------

/**
 * Connects the chosen wallet app: opens it with the pairing link and waits for
 * the user to approve. Resolves with the connected address.
 */
export async function connectWallet(app: WalletApp): Promise<Hex> {
  walletTrace(`connect ${app.name}`, true);
  const provider = await walletConnectProvider();
  walletTrace('WalletConnect ready');
  if (provider.session) await provider.disconnect().catch(() => {});
  set({ status: 'connecting', app });

  const onUri = (uri: string) => {
    walletTrace('proposal sent, opening the wallet');
    Linking.openURL(app.pairLink(uri)).catch(() => {
      if (state.status === 'connecting') set({ status: 'idle' });
    });
  };
  provider.on('display_uri', onUri);
  inFlight++;
  try {
    const session = await provider.connect({ optionalNamespaces: NAMESPACES });
    walletTrace('connection approved');
    const { address, chainId } = parseAccount(
      session?.namespaces.eip155?.accounts[0],
    );
    if (!address) throw new Error('The wallet didn’t share an account.');
    await AsyncStorage.setItem(WALLET_APP_KEY, app.id).catch(() => {});
    set({ status: 'connected', address, chainId, app });
    return address;
  } catch (e) {
    set({ status: 'idle' });
    throw new Error(walletErrorMessage(e, 'The wallet didn’t connect.'));
  } finally {
    inFlight--;
    provider.off('display_uri', onUri);
  }
}

/** Stops waiting for a connection the user abandoned. */
export function cancelConnect(): void {
  if (state.status === 'connecting') set({ status: 'idle' });
}

export async function disconnectWallet(): Promise<void> {
  const provider = await walletConnectProvider();
  await provider.disconnect().catch(() => {});
  await AsyncStorage.removeItem(WALLET_APP_KEY).catch(() => {});
  set({ status: 'idle' });
}

// --- requests --------------------------------------------------------------

/** User-facing message for a wallet error. */
export function walletErrorMessage(e: unknown, fallback: string): string {
  const text = e instanceof Error ? e.message : String(e ?? '');
  const code = (e as { code?: number } | null)?.code;
  if (code === 4001 || /reject|denied|cancel/i.test(text)) {
    return 'Cancelled in your wallet.';
  }
  if (STALE_SESSION.test(text)) return WALLET_SESSION_EXPIRED;
  return text || fallback;
}

/** Brings the connected wallet app to the front ("Other wallet" can't be). */
export async function openWalletApp(): Promise<void> {
  const scheme = state.app?.scheme;
  if (scheme) await Linking.openURL(`${scheme}://`).catch(() => {});
}

/**
 * The network to tag a request with: `preferred` if the session approved it,
 * otherwise one it did (wallets often approve only networks they already
 * know). The wallet acts on its own current network, which callers switch first.
 */
function approvedChain(provider: UniversalProvider, preferred: number): number {
  const ns = provider.session?.namespaces.eip155;
  const approved = new Set(
    [
      ...(ns?.chains ?? []),
      ...(ns?.accounts ?? []).map(a => a.split(':').slice(0, 2).join(':')),
    ]
      .map(parseChain)
      .filter((id): id is number => id !== undefined),
  );
  if (approved.has(preferred)) return preferred;
  return approved.values().next().value ?? preferred;
}

/**
 * Resolves with the request's id once WalletConnect has published a `method`
 * request on `topic` to its relay — only then is there something for the
 * wallet to show.
 */
function whenSent(
  provider: UniversalProvider,
  topic: string,
  method: string,
): { sent: Promise<number>; stop: () => void } {
  const events = provider.client.events;
  let onSent: (e: {
    id: number;
    topic: string;
    request: { method: string };
  }) => void;
  const sent = new Promise<number>(resolve => {
    onSent = e => {
      if (e.topic === topic && e.request.method === method) resolve(e.id);
    };
    events.on('session_request_sent', onSent);
  });
  return { sent, stop: () => events.off('session_request_sent', onSent) };
}

/** How long a request's id keeps a listener for a late duplicate answer. */
const DUPLICATE_WINDOW_MS = 2 * 60 * 1000;

/**
 * MetaMask (and other wallets) sometimes answer a request twice, each copy
 * encrypted separately, so WalletConnect's duplicate-message check misses the
 * second one. WalletConnect removes the request's listener after the first
 * answer and then throws on the second ("emitting session_request:<id> without
 * any listeners"). A no-op listener on the id for a while drops it instead.
 *
 * `engine.events` is internal to WalletConnect's sign-client (not in its
 * types); the event name is its `engineEvent('session_request', id)`.
 */
function ignoreLateAnswers(provider: UniversalProvider, id: number): void {
  const events = (
    provider.client.engine as unknown as {
      events: {
        on(name: string, fn: () => void): void;
        off(name: string, fn: () => void): void;
      };
    }
  ).events;
  const name = `session_request:${id}`;
  let answers = 0;
  const drop = () => {
    // The first call is the real answer, which WalletConnect's own listener
    // handles too; any after that are duplicates.
    if (++answers > 1) walletTrace('duplicate answer ignored');
  };
  events.on(name, drop);
  setTimeout(() => events.off(name, drop), DUPLICATE_WINDOW_MS);
}

/**
 * Sends one request straight to the wallet, then brings the wallet app to the
 * front so the user sees it. The wallet opens only after the request reached
 * the relay: opened sooner, Android pauses Zeno in the background before it
 * sends, and the wallet sits there with nothing to show. A dead session is
 * cleared, so the app asks for a fresh connection instead of waiting on one
 * that's gone.
 */
async function walletRequest<T>(
  method: string,
  params: unknown[],
  chainId: number,
): Promise<T> {
  const provider = await walletConnectProvider();
  const topic = provider.session?.topic;
  if (!topic || state.status !== 'connected') {
    set({ status: 'idle' });
    throw new Error(WALLET_SESSION_EXPIRED);
  }
  walletTrace(`${method}: sending`);
  inFlight++;
  const { sent, stop } = whenSent(provider, topic, method);
  const pending = provider.client.request<T>({
    topic,
    chainId: caip(approvedChain(provider, chainId)),
    request: { method, params },
  });
  try {
    // Refused before sending (e.g. a dead session): nothing to open.
    const sentId = await Promise.race([
      sent,
      pending.then(
        () => undefined,
        () => undefined,
      ),
    ]);
    stop();
    if (sentId !== undefined) {
      ignoreLateAnswers(provider, sentId);
      walletTrace(`${method}: sent, opening the wallet`);
      await openWalletApp();
    }
    const result = await pending;
    walletTrace(`${method}: answered`);
    return result;
  } catch (e) {
    walletTrace(`${method}: failed (${(e as Error)?.message})`);
    const message = walletErrorMessage(
      e,
      'Your wallet couldn’t complete the request.',
    );
    if (message === WALLET_SESSION_EXPIRED) await disconnectWallet();
    throw Object.assign(new Error(message), {
      code: (e as { code?: number })?.code,
    });
  } finally {
    inFlight--;
  }
}

/**
 * Asks the wallet to move to `chainId`; the wallet shows its own "switch
 * network" prompt, or "add network" first if it doesn't know the chain.
 * Skipped when the wallet already reported being on it.
 */
export async function switchChain(chainId: number): Promise<void> {
  if (state.chainId === chainId) return;
  try {
    await walletRequest(
      'wallet_switchEthereumChain',
      [{ chainId: numberToHex(chainId) }],
      chainId,
    );
  } catch (e) {
    const code = (e as { code?: number }).code;
    if (
      code !== 4902 &&
      !/unrecognized|not added|unknown chain/i.test(
        String((e as Error).message),
      )
    ) {
      throw e;
    }
    const chain = CHAINS.find(c => c.id === chainId);
    if (!chain) throw e;
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
  set({ ...state, chainId });
}

/** personal_sign: a chain-agnostic signature (sign-in messages). */
export function signMessage(message: string, address: Hex): Promise<Hex> {
  return walletRequest<Hex>(
    'personal_sign',
    [toHex(message), address],
    state.chainId ?? mainnet.id,
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
  const address = state.address;
  if (state.status !== 'connected' || !address) {
    throw new Error(WALLET_SESSION_EXPIRED);
  }
  try {
    await switchChain(tx.chainId);
  } catch (e) {
    throw new Error(
      (e as Error).message === 'Cancelled in your wallet.'
        ? `Switch your wallet to ${tx.chainId === robinhood.id ? 'Robinhood Chain' : 'the right network'} to continue.`
        : (e as Error).message,
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
