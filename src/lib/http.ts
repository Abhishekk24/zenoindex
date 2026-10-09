/**
 * Thin HTTP layer for the hosted app's /api/v1 proxy.
 *
 * - Session: the web app issues an `HttpOnly` `dtf_session` cookie. Native
 *   cookie handling on device is inconsistent, so the token value is kept in
 *   SecureStore and sent as an explicit `Cookie` header.
 * - Errors: the API answers `{ error: { status, code, message, retryable } }`.
 * - Writes: every POST carries a fresh `Idempotency-Key`.
 */
import * as SecureStore from 'expo-secure-store';

import { API_BASE } from './env';

const SESSION_KEY = 'dtf.session';
const TIMEOUT_MS = 20_000;

export class ApiError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: string,
    message: string,
    public readonly retryable: boolean,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

let sessionCookie: string | null | undefined;

async function storedSession(): Promise<string | null> {
  if (sessionCookie === undefined) {
    try {
      sessionCookie = await SecureStore.getItemAsync(SESSION_KEY);
    } catch {
      sessionCookie = null;
    }
  }
  return sessionCookie;
}

async function saveSession(value: string | null): Promise<void> {
  sessionCookie = value;
  try {
    if (value) await SecureStore.setItemAsync(SESSION_KEY, value);
    else await SecureStore.deleteItemAsync(SESSION_KEY);
  } catch {
    // SecureStore unavailable (e.g. Expo Go); keep the in-memory value.
  }
}

/** Drop the held session — call after logout or on a 401. */
export async function clearSession(): Promise<void> {
  await saveSession(null);
}

/** True when a session cookie is already held (skips the SecureStore read after boot). */
export function hasSession(): boolean {
  return Boolean(sessionCookie);
}

function setCookieHeaders(headers: Headers): string[] {
  const withGetSetCookie = headers as Headers & {
    getSetCookie?: () => string[];
  };
  if (typeof withGetSetCookie.getSetCookie === 'function') {
    return withGetSetCookie.getSetCookie();
  }
  const single = headers.get('set-cookie');
  return single ? [single] : [];
}

function captureSession(headers: Headers): void {
  for (const setCookie of setCookieHeaders(headers)) {
    const match = /dtf_session=([^;]*)/.exec(setCookie);
    if (!match) continue;
    const value = match[1] ?? '';
    // An empty value is the server clearing the cookie (logout).
    void saveSession(value || null);
    return;
  }
}

function uuid(): string {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

export type ApiRequest = {
  method?: 'GET' | 'POST' | 'DELETE';
  body?: unknown;
  /** Chain override for `X-DTF-Chain-ID` when a call is chain-specific. */
  chainId?: number;
  timeoutMs?: number;
};

async function request<T>(path: string, init: ApiRequest = {}): Promise<T> {
  const method = init.method ?? 'GET';
  const controller = new AbortController();
  const timer = setTimeout(
    () => controller.abort(),
    init.timeoutMs ?? TIMEOUT_MS,
  );

  const headers: Record<string, string> = { accept: 'application/json' };
  const cookie = await storedSession();
  if (cookie) headers['cookie'] = `dtf_session=${cookie}`;
  if (init.chainId !== undefined)
    headers['x-dtf-chain-id'] = String(init.chainId);
  if (method === 'POST') headers['idempotency-key'] = uuid();
  if (init.body !== undefined) headers['content-type'] = 'application/json';

  let response: Response;
  try {
    response = await fetch(`${API_BASE}${path}`, {
      method,
      headers,
      signal: controller.signal,
      body: init.body === undefined ? undefined : JSON.stringify(init.body),
    });
  } catch (e) {
    if (e instanceof Error && e.name === 'AbortError') {
      throw new ApiError(
        0,
        'timeout',
        'This is taking too long. Check your connection and try again.',
        true,
      );
    }
    throw new ApiError(
      0,
      'network',
      "Can't connect. Check your internet connection and try again.",
      true,
    );
  } finally {
    clearTimeout(timer);
  }

  captureSession(response.headers);

  const text = await response.text();
  let body: Record<string, unknown> = {};
  if (text) {
    try {
      body = JSON.parse(text) as Record<string, unknown>;
    } catch {
      // Not our API answering (e.g. a tunnel's "offline" page or a proxy's
      // HTML error): say so plainly instead of surfacing a parser error.
      throw new ApiError(
        response.status,
        'unavailable',
        "Zeno's servers can't be reached right now. Please try again in a moment.",
        true,
      );
    }
  }

  if (!response.ok) {
    const error = (body['error'] ?? {}) as {
      status?: number;
      code?: string;
      message?: string;
      retryable?: boolean;
    };
    if (response.status === 401) await saveSession(null);
    throw new ApiError(
      error.status ?? response.status,
      error.code ?? 'request_failed',
      error.message ?? `Request failed (${response.status})`,
      error.retryable ?? response.status >= 500,
    );
  }
  return body as T;
}

export const api = {
  get: <T>(path: string, init?: Omit<ApiRequest, 'method' | 'body'>) =>
    request<T>(path, { ...init, method: 'GET' }),
  post: <T>(path: string, body?: unknown, init?: Omit<ApiRequest, 'method'>) =>
    request<T>(path, { ...init, method: 'POST', body: body ?? {} }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
