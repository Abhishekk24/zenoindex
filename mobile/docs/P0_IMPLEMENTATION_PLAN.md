# ZenoIndex Mobile — P0 Implementation Plan

Mobile is a **consumer of the hosted DTF infrastructure** — the same way
`apps/dtf-app` is the reference web consumer. All data and transactions go
through the hosted app's `GET/POST /api/v1/*` proxy (which holds `CORE_API_KEY`
server-side). The app never holds an API key and never talks to core-api
directly.

Status of the backend was verified live on 2026-10-06 (see
`programmable-dtf-infra/docs/LOCAL_E2E_BUGS.md`). Endpoints marked ✅ were
exercised end-to-end; ⚠️ items are broken/blocking upstream.

---

## Verified backend surface (what we can build on)

✅ `POST /api/v1/auth/otp/request` → `otp/verify` → session cookie → `GET /auth/me`
✅ `POST /auth/profile`, `POST /auth/accept-terms`, `POST /auth/logout`
✅ `POST /auth/wallet/challenge` → `personal_sign` → `POST /auth/wallet/verify`
✅ `GET /auth/wallets`, primary/remove wallet endpoints
✅ `GET /v1/chains`, `/v1/assets`, `/v1/dtfs`, `/v1/config`, `/v1/chains-and-providers`
✅ `GET /v1/dtfs/:id` (metadata ✓; `readModels.*` currently `unavailable` — BUG-2)
✅ `POST /v1/dtfs/:id/buy/prepare` → sign/send → `POST /v1/operations/:id/submit` → `confirm`
✅ `POST /v1/dtfs/:id/redeem/prepare` → same lifecycle (shares burn verified)
✅ `GET /v1/operations` list/get
✅ `GET /compliance/kyc/:wallet/status`
⚠️ `GET /wallets/:wallet/portfolio` — returns `positions:[]` always (BUG-1, stub)
⚠️ `/dtfs/:id` `readModels` — permanently `unavailable` (BUG-2, address case)
⚠️ fee-bearing `buy/prepare` draft → on-chain revert (BUG-3, gross-vs-net)
⚠️ `/v1/dtfs` ~30s under parallel valuation (BUG-4, pool `max:1`)
⛔ in-kind redeem, permissioned pools, `/dtfs/:id/pools` — unavailable by design

---

## P0-0 — Foundation

**0.1 Environment config.** `EXPO_PUBLIC_API_URL` per build profile
(dev/stage/prod) in `app.config.ts`/`.env`. No `CORE_API_KEY` anywhere.

**0.2 API client** (`src/lib/api.ts` rewrite):
- cookie-based session: capture `Set-Cookie` on responses, persist via
  `expo-secure-store`, attach `Cookie` header on requests (RN `fetch` doesn't
  keep a cookie jar); OR negotiate a token transport if backend adds one
- standard error envelope: `{ error: { status, code, message, retryable } }`
- `Idempotency-Key` header on all POST writes; `X-DTF-Chain-ID` when needed
- timeout (15s), `AbortController` support, retry only when `retryable: true`
- typed wrappers for every endpoint used below

**0.3 Types/adapters** (`src/lib/types.ts`, new `src/lib/adapters.ts`):
- unwrap `{ items: [...] }` list responses
- `readModels` availability envelope → `status: "available" | "unavailable"` UI
  state (never silently coerce unavailable → empty)
- numeric strings stay strings (BigInt/decimal — no `Number()` on amounts)
- preserve `meta` freshness (`generatedAt`, `blockNumber`, `priceAt`)

**0.4 Session store** (`src/lib/session.tsx`):
- persist session across restarts (secure-store), hydrate on boot with a splash
- call `/auth/me` on boot; on 401 → sign-in flow
- replace all sample data paths with the real client

## P0-1 — Auth & onboarding

- Email OTP: request → verify → resend w/ cooldown; wire `requestEmailCode`,
  `verifyEmailCode`, `acceptTerms`, `completeProfile`, `signOut` to real calls
- Screens already exist (`sign-in.tsx`, `terms.tsx`, `complete-profile.tsx`) —
  swap mock impls; add expired/lockout/invalid-code states
- Route guard in `app/_layout.tsx` driven by `/auth/me`
- Deferred: Google OAuth (backend callback is web-redirect only — needs a
  mobile deep-link path upstream first), 2FA

## P0-2 — Wallet connect & server-verified linking

- Reown AppKit connect (`src/config/wallet.ts` exists; set
  `EXPO_PUBLIC_REOWN_PROJECT_ID`)
- Supported chains come from `/v1/chains` + `/v1/config` — **remove hardcoded
  `46630`**; wrong-chain switch prompt
- Link flow: `POST /auth/wallet/challenge` → `personal_sign` the exact message
  → `POST /auth/wallet/verify` → refresh `/auth/me`
- Profile tab: linked-wallets list, set-primary, remove, disconnect vs. unlink
- Signature-rejected / already-linked / expired-challenge states

## P0-3 — Discovery & DTF detail

- Explore tab → `GET /v1/dtfs` (search/sort params), `GET /v1/assets`
- `basket/[id].tsx` → `GET /v1/dtfs/:id`: name, symbol, NAV, share price, AUM,
  fees (entry/exit/mgmt bps), minInvestment, weights, lifecycle, provider,
  `valuationStatus`, `priceStale`, `constituents`
- `readModels.holdings/performance/recentTransactions` → render when
  `available`, explicit "Indexing pending" card when `unavailable` (BUG-2 makes
  this the common case today — the UI must handle it gracefully)
- Pull-to-refresh; explorer links for contract + txs

## P0-4 — Invest & redeem (the core transaction loop)

`TradePanel.tsx` replaces its fake preview with the real lifecycle:

1. **Prepare**: `POST /dtfs/:id/buy/prepare { amount, recipient }` (and
   `redeem/prepare { shares, recipient }`) → returns `{ operationId, transaction
   { to, data, chainId, gas } , draft }`
2. **Approve**: if draft includes an approval step, send ERC-20 `approve` first
3. **Send**: sign/broadcast via connected wallet (wagmi/Reown EIP-1193)
4. **Submit**: `POST /operations/:id/submit { txHash }`
5. **Track**: poll `GET /operations/:id` → `submitted → confirmed/failed`;
   pending sheet with explorer link; refresh detail + portfolio on confirm

Gates:
- Ship buy only after **BUG-3** is fixed upstream (any DTF with `entryBps>0`
  reverts today). Feature-flag fee-bearing DTFs until then.
- Auto-quote/preview needs a real liquidity venue upstream — until then the app
  shows quotes returned in the prepare response only; never invent a local
  `venueId/route` (that's test scaffolding).
- Min-investment check from `minInvestmentRaw` before enabling the CTA.

## P0-5 — Portfolio

Blocked on **BUG-1** (`/wallets/:wallet/portfolio` returns a stub). Two tracks:

- **Preferred**: backend implements the wallet-positions read model (indexer
  already records per-portfolio deposits/redeems; needs a per-wallet balance
  projection). Mobile then renders positions + value + meta freshness.
- **Interim (mobile-only fallback)**: enumerate `/v1/dtfs`, read each portfolio
  `balanceOf(wallet)` + `convertToAssets` on-chain via the chain `rpcUrl` from
  `/v1/chains`, join with `/dtfs/:id` for display fields. Keeps P0 unblocked;
  replace with the endpoint once real.

Portfolio tab renders positions, total value, per-position NAV/share price;
activity list per DTF once `recentTransactions` is available (BUG-2).

## P0-6 — Compliance gating

- `GET /compliance/kyc/:wallet/status` on wallet link + before invest
- Status mapping: `approved` → invest enabled; `pending/rejected/expired` →
  status card + "Start verification" → `POST /eligibility/kyc/start` → open
  returned provider URL (system browser) → deep-link return → poll status
- Depends on upstream Didit config; ship the gating + status UI regardless

---

## Explicitly NOT in P0

- Manager flows (create/seed/rebalance/corporate actions/fees) — separate scope
- In-kind redeem, permissioned liquidity, pool launch — backend-unavailable
- Zap / alternative-token invest — no real venue quoting yet
- Sessions list, active-session revoke — no API
- Preview/auto-quote UI — no live venue configured

## Test plan

- API-level integration suite mirroring today's verified calls
  (auth → link → list → detail → prepare → submit → confirm)
- E2E on device/emulator against hosted dev env; deterministic waits on
  operation status transitions
- Unavailable-states coverage: BUG-1/2 paths must render "unavailable" correctly

## Sequenced checklist

| # | Deliverable | Depends on |
|---|---|---|
| 1 | api client + env + types/adapters | — |
| 2 | session persistence + boot `/auth/me` | 1 |
| 3 | OTP auth + terms/profile | 1–2 |
| 4 | Reown connect + challenge/sign/verify link | 1–3 |
| 5 | Explore + basket detail (real data) | 1 |
| 6 | Portfolio screen | BUG-1 (or interim on-chain fallback) |
| 7 | Buy/redeem lifecycle + op tracking | 1, 4; BUG-3 for fee DTFs |
| 8 | KYC status + gating | 1, 4 |
| 9 | Hardening: errors, retries, freshness, offline | all |
