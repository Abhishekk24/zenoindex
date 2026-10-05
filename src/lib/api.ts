/**
 * The app's only data boundary. Every screen reads through these functions.
 *
 * Today each one answers from the sample data in lib/data.ts. When the app is
 * connected, each body becomes a request to the web app's /api/v1 (the path is
 * noted on every function): the web app holds the session and the core API
 * key, so the app never calls the core API directly.
 */
import { useCallback, useEffect, useState } from 'react';

import {
  SAMPLE_ASSETS,
  SAMPLE_COST_BASIS,
  SAMPLE_DTFS,
  SAMPLE_ELIGIBILITY,
  SAMPLE_PORTFOLIO,
  SAMPLE_SESSIONS,
  sampleDtfDetail,
  sampleNewUser,
  samplePreview,
  sampleUser,
  sampleWalletActivity,
} from './data';
import type {
  Asset,
  Dtf,
  DtfDetail,
  Eligibility,
  Session,
  TradePreview,
  User,
  WalletPortfolio,
  WalletTransaction,
} from './types';

/** Simulates a round trip so loading states are visible while on sample data. */
function sample<T>(value: T): Promise<T> {
  return new Promise(resolve => setTimeout(() => resolve(value), 250));
}

// Discovery -------------------------------------------------------------------

/** GET /api/v1/dtfs */
export function listDtfs(): Promise<Dtf[]> {
  return sample(SAMPLE_DTFS);
}

/** GET /api/v1/assets */
export function listAssets(): Promise<Asset[]> {
  return sample(SAMPLE_ASSETS);
}

/** GET /api/v1/dtfs/:id (the API nests the lists under `readModels`). */
export async function getDtf(id: string): Promise<DtfDetail> {
  const detail = await sample(sampleDtfDetail(id));
  if (!detail) throw new Error('This basket could not be found.');
  return detail;
}

/** POST /api/v1/dtfs/:id/buy/prepare or …/redeem/prepare. Preview only; nothing is signed. */
export async function previewTrade(
  dtf: Dtf,
  side: TradePreview['side'],
  amount: string,
): Promise<TradePreview> {
  return sample(samplePreview(dtf, side, amount));
}

// Portfolio -------------------------------------------------------------------

export type PortfolioView = {
  portfolio: WalletPortfolio;
  /** Amount paid into each basket, keyed by DTF id. */
  costBasis: Record<string, string>;
  activity: WalletTransaction[];
};

/** GET /api/v1/wallets/:wallet/portfolio and the wallet's transactions. */
export function getPortfolio(_wallet: string): Promise<PortfolioView> {
  return sample({
    portfolio: SAMPLE_PORTFOLIO,
    costBasis: SAMPLE_COST_BASIS,
    activity: sampleWalletActivity(),
  });
}

// Account ---------------------------------------------------------------------

/** POST /api/v1/auth/otp/request */
export function requestEmailCode(_email: string): Promise<void> {
  return sample(undefined);
}

/**
 * POST /api/v1/auth/otp/verify. On sample data any 6-digit code works, and
 * the account is new (terms and profile pending) unless the email is the
 * sample investor's.
 */
export async function verifyEmailCode(
  email: string,
  code: string,
): Promise<User> {
  if (!/^\d{6}$/.test(code))
    throw new Error('Enter the 6-digit code from your email.');
  return sample(
    email === 'investor@zeno.example'
      ? sampleUser(email)
      : sampleNewUser(email),
  );
}

/** POST /api/v1/auth/accept-terms */
export function acceptTerms(user: User): Promise<User> {
  return sample({ ...user, termsAcceptedAt: new Date().toISOString() });
}

export type ProfileDetails = {
  firstName: string;
  lastName: string;
  country: string;
};

/** POST /api/v1/auth/profile */
export function completeProfile(
  user: User,
  details: ProfileDetails,
): Promise<User> {
  return sample({
    ...user,
    ...details,
    displayName: `${details.firstName} ${details.lastName}`,
    profileCompletedAt: new Date().toISOString(),
  });
}

/** POST /api/v1/auth/logout */
export function signOut(): Promise<void> {
  return sample(undefined);
}

/** GET /api/v1/compliance/kyc/:wallet/status */
export function getEligibility(_wallet: string | null): Promise<Eligibility> {
  return sample(SAMPLE_ELIGIBILITY);
}

/** No sessions API yet on the web either; Profile → Security shows sample rows. */
export function listSessions(): Promise<Session[]> {
  return sample(SAMPLE_SESSIONS);
}

/** Development only: sign straight in as the sample investor. */
export function sampleInvestor(): User {
  return sampleUser();
}

// Hook ------------------------------------------------------------------------

export type Loadable<T> = {
  data?: T;
  error?: string;
  loading: boolean;
  reload: () => void;
};

/**
 * Runs `load` on mount and whenever `key` changes. While a reload is in
 * flight the previous data stays visible.
 */
export function useLoad<T>(load: () => Promise<T>, key: string): Loadable<T> {
  const [attempt, setAttempt] = useState(0);
  const request = `${key}#${attempt}`;
  // Each result remembers the request it answers; `loading` means there is
  // no result for the current request yet.
  const [result, setResult] = useState<{
    request?: string;
    data?: T;
    error?: string;
  }>({});

  useEffect(() => {
    let live = true;
    load().then(
      data => {
        if (live) setResult({ request, data });
      },
      (error: unknown) => {
        if (live) {
          setResult(previous => ({
            request,
            data: previous.data,
            error:
              error instanceof Error ? error.message : 'Something went wrong.',
          }));
        }
      },
    );
    return () => {
      live = false;
    };
    // `load` is a fresh closure each render; `request` says when it really
    // changed.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [request]);

  const reload = useCallback(() => setAttempt(n => n + 1), []);
  const answered = result.request === request;
  return {
    data: result.data,
    error: answered ? result.error : undefined,
    loading: !answered,
    reload,
  };
}
