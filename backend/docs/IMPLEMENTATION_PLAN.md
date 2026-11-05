# zenoIndex-backend — Implementation Plan

Status: draft v1 · 2026-10-10

## Context

- `zenoindex-evm` is the new DTF protocol: a factory (`ZenoIndexVault`) + per-index `Vault` clones + `ShareToken`, USDG as the stablecoin. Mainnet (Robinhood, chainId 4663) deployed from commit `7663cc6` (branch `feat/zenoindex/phase-1-hardening`).
- The mobile app (`zenoIndex-mobile-app`) currently talks to `programmable-dtf-infra` (dtf-app proxy → core-api), which is built for the **old** contracts (`Portfolio`/ERC-4626). We are **not touching** that repo; it is reference only.
- This repo is a **new, standalone, API-key backend** for the new contracts. First client: the mobile app. Later: other DTF apps we launch or sell → it must be **multi-tenant and API-key based** from day one.
- Demo in ~10 hours: must show **login → buy a basket → sell it** end to end.

## Decisions

| Topic | Decision |
|---|---|
| Stack | Node 22 + TypeScript, **Hono** (`@hono/node-server`), **zod** validation, **viem**, **Postgres** (`postgres` driver, raw SQL migrations), **vitest**. pnpm. |
| Access model | Every request carries an **API key** → identifies the tenant project. End-user actions additionally need a **user session**. |
| Key types | `pk_live_…` **publishable** (safe to ship in a mobile app: only public reads + end-user-session endpoints, rate-limited, optional bundle-id/origin allowlist). `sk_live_…` **secret** (server-to-server only: admin, metadata, user lookup, webhooks later). Keys stored as SHA-256 hash + visible prefix; never stored raw. |
| End-user login | **Reown AppKit** in the app (external wallet *or* email/social embedded wallet) → **SIWE (EIP-4361)** with a **server-stored, single-use nonce** → session token. Verify with viem `publicClient.verifySiweMessage` (handles EOA + ERC-1271/6492 smart-account signatures from embedded wallets). No email OTP. |
| Session transport | Opaque random token, SHA-256 hashed in DB, 30 days. Accepted as `Authorization: Bearer <token>` **or** `Cookie: dtf_session=<token>` (the app already sends the cookie). Also returned in the response body. |
| API shape | Mounted at **`/api/v1`**, same paths/response shapes the app already uses (see `zenoIndex-mobile-app/src/lib/api.ts`, `adapters.ts`) — except auth (SIWE) and redeem (multi-step). |
| Chain data | v1 reads the chain **directly** (viem multicall). No indexer for the demo. Indexer (Ponder) is Phase 3. |
| Tx building | Backend returns unsigned calldata; the **user's wallet signs** every tx (contracts require `msg.sender` = user). Backend never holds user keys. |
| Multi-tenancy | Every tenant-owned row has `project_id`; every query is scoped by the project resolved from the API key. |
| Network | **Robinhood mainnet (4663) only.** No local/anvil chain. RPC `https://rpc.mainnet.chain.robinhood.com`. |
| Contract interface | A typed **SDK package** `@zenoindex/sdk` (same pattern as `evm-launhpad-contract/frontend/sdk/*`): generated ABIs + mainnet constants + typed read helpers + calldata builders. Backend imports it; customers buying the API can use it too. |

### Contract SDK (`packages/sdk`)

Modeled on `evm-launhpad-contract/frontend/sdk/arc-feeclaimer-vault` (`src/abis.ts` "Generated from forge artifacts. Do not edit by hand." + `src/index.ts` constants/helpers, consumed via `file:` dependency).

```
packages/sdk/
  src/abis.ts        # GENERATED: ZenoIndexVaultAbi, VaultAbi, ShareTokenAbi, UniswapV4AdapterAbi (as const)
  src/constants.ts   # ROBINHOOD_CHAIN_ID=4663, FACTORY, ACCESS_MASTER, VAULT_IMPL, USDG, DEPLOY_BLOCK=83351081, EVM_COMMIT='7663cc6'
  src/reads.ts       # listVaults, getVault (multicall), getAssets, previewDeposit, getRedeemProgress, swapFloor
  src/tx.ts          # buildDeposit, buildRequestRedeem, buildSwapAssetToUsdc, buildClaim, buildClaimInKind → {to,data,value}
  src/index.ts
  scripts/gen-abis.mjs  # reads zenoindex-evm/out/*.json at a pinned commit → writes src/abis.ts
  README.md
```
Lives **in this repo** (pnpm workspace) so we control it without touching the evm team's repo. `gen-abis` checks the evm repo is at `EVM_COMMIT` and fails otherwise, so ABIs never drift from mainnet.

### Who holds which key (MVP: mobile app is the only client)

| Thing | Who has it | Where it lives | If it leaks |
|---|---|---|---|
| `pk_live_…` publishable key | the mobile app (so effectively anyone who installs it) | `EXPO_PUBLIC_API_KEY` in the app build | low risk by design: only public reads + login; every user action still needs that user's session; revoke + ship a new build |
| `sk_live_…` secret key | **only you / the backend team** | password manager; used from curl/CLI for admin (DTF metadata, swap paths) | high: rotate immediately. **Never** in the app, never in git |
| User session token | each end user, for themselves | phone SecureStore (app already does this) | only that one user's account; expires in 30 days, logout revokes |
| DB URL, RPC URL | backend server only | server env vars | infra-level secret |
| Private keys | **backend holds none** in v1 | — | users sign in their own wallet; admin/keeper keys stay with the evm team |
| Raw API keys in DB | nobody | DB stores only SHA-256 hash + prefix | a DB leak doesn't reveal usable keys |

In the MVP you create **one organization, one project, one `pk` (for the app) and one `sk` (for you)** with the CLI.

### What we take from programmable-dtf-infra (reference only)

| Take | From | Fix vs original |
|---|---|---|
| Error class + JSON envelope `{error:{status,code,message,retryable}}` | `packages/errors/src/index.ts` | same shape — the app already parses it |
| Bigint decimal math (no floats) | `packages/decimal/src/*` | copy |
| Raw SQL migrations + checksum ledger | `packages/db/src/migrate/runner.ts` | add `pg_advisory_lock` |
| Hashed session tokens | `apps/dtf-app/lib/auth.ts` (sessions) | index on `user_id`, expiry cleanup |
| Operations lifecycle `draft_prepared → submitted → confirmed/failed` | `packages/db/migrations/0007_operations.up.sql` | persist in DB (infra kept them in memory), guarded transitions (`UPDATE … WHERE status=$prev`), **verify receipt on-chain** and match `to`/`data` to the draft |
| Gas estimate +20% buffer | `packages/core-api/src/index.ts:4123` | same, never silently drop errors |
| Log redaction | `packages/observability` | copy |
| **Avoid** | wallet login without server nonce (`auth.ts:1842`, replayable), unauthenticated KYC routes, CORS `*`, 7k-line god file, operations in memory, idempotency key ignored |

## Data model (migration `0001_init.sql`)

```
organizations(id, name, created_at)
projects(id, organization_id, name, chain_id, factory_address, siwe_domain, created_at)
api_keys(id, project_id, type 'publishable'|'secret', prefix, key_hash UNIQUE, name,
         allowed_origins text[], revoked_at, last_used_at, created_at)
users(id, project_id, wallet_address /*lowercase*/, first_name, last_name, display_name, country,
      terms_accepted_at, privacy_accepted_at, created_at, updated_at,
      UNIQUE(project_id, wallet_address))
sessions(token_hash PK, user_id, project_id, expires_at, created_at)   + index(user_id)
siwe_nonces(nonce PK, project_id, expires_at, used_at)
dtf_metadata(project_id, chain_id, vault_address, name, description, logo_url, hidden bool,
             PK(project_id, chain_id, vault_address))
operations(id uuid, project_id, user_id, wallet, action 'buy'|'redeem_request'|'redeem_swap'|'redeem_claim',
           vault_address, chain_id, tx_to, tx_data, tx_value numeric(78,0), tx_hash, status, failure_reason,
           created_at, submitted_at, confirmed_at, failed_at,  UNIQUE(chain_id, tx_hash))
idempotency_keys(project_id, key, request_hash, response jsonb, created_at, PK(project_id, key))
swap_paths(chain_id, asset_address, path text[] /* asset … usdg */, PK(chain_id, asset_address))
```
`swap_paths` exists because the chain stores no routes and the adapter has no pool enumeration (only `PoolRegistered` events). Seeded by CLI for v1; derived from indexed `PoolRegistered` in Phase 3.
All addresses lowercased at the write boundary (infra BUG-2).

## API (all under `/api/v1`, all require `x-api-key`)

**Public (pk or sk):**
- `GET /chains` → `{items:[{chainId,name,rpcUrl,explorerUrl}]}`
- `GET /dtfs` → `{items: DtfRow[]}` — from factory `totalVaults/vaultClones` + per-vault multicall (`totalNav`, `totalShares`, `sharesToken`, fees, `numAssets/assetIdAt/allocationBpsAt`, `genesisDone`, `paused`) + `dtf_metadata`
- `GET /dtfs/:id` → DtfRow + `totalSupplyRaw` + `readModels` (holdings from `balanceOf`; performance/recentTransactions `unavailable` until Phase 3)
- `GET /assets` → factory `totalAssets/getAsset` + ERC-20 name/symbol/decimals
- `GET /compliance/kyc/:wallet/status` → `200 {status:'not_started', approved:false}` stub (the basket page needs a 200)

**Auth (pk):**
- `POST /auth/siwe/nonce` `{walletAddress, chainId}` → `{nonce, message}` (server builds the EIP-4361 message; domain from project)
- `POST /auth/siwe/verify` `{message, signature}` → `{user, token}` + `Set-Cookie: dtf_session`; creates the user on first login
- `GET /auth/me`, `POST /auth/accept-terms`, `POST /auth/profile`, `POST /auth/logout` — same shapes as today; `user.wallets=[{address,chainId,isPrimary:true}]`, `user.walletAddress` = signer

**User session required (pk + session):**
- `POST /dtfs/:id/buy/prepare` `{amount, recipient, slippageBps?}` → TxDraft: `deposit(usdgRaw, minSharesOut)`; `minSharesOut = previewDeposit.sharesOut × (1 − slippage)`; `data.entryFee/estimatedShares` from `previewDeposit`. `transaction.to` = vault (also the approve spender — the app already approves the gross amount, which is what `deposit` pulls).
- `POST /dtfs/:id/redeem/prepare` `{shares, recipient, owner}` → **next step** of the redeem state machine, read from `getRedeemState/getRedeemAssetAmount` on-chain:
  1. no open redeem → `requestRedeem(sharesRaw)`
  2. open, a leg with `amountIn > 0 && !swapped` → `swapAssetToUsdc(i, path, minUsdcOut)`; path from `swap_paths`; `minUsdcOut = swapFloor(mint, usdg, amountIn)` read on-chain (the contract raises anything lower to this floor anyway; DEX quote added later)
  3. all legs done → `claim()`
  Response adds `step` and `stepsRemaining`; the app calls prepare again after each confirm until `stepsRemaining = 0`.
  Body `{inKind: true}` → step 2 is skipped and the final step is `claimInKind()` (pays basket tokens, works even with stale prices / no route — the safe fallback).
  Pre-checks before returning a tx (clear error instead of a revert): `paused`, `adminLocked`, `isEmergency`, `genesisDone`, share cap, share balance, `RedeemAlreadyPending`, price staleness (`priceUpdatedAt + maxPriceAge`).
- `POST /operations/:id/submit|confirm|fail`, `GET /operations/:id` — flat Operation object. `confirm` fetches the receipt itself and checks `status`, `to`, and `input == tx_data`; client claim is not trusted.
- `GET /wallets/:wallet/portfolio` → `{positions:[{dtfId, shares(raw), value(human)}]}` from `balanceOf` on every vault's share token × NAV/share. Only the session's own wallet.
- `GET /dtfs/:id/transactions` → user's operations for that vault (until the indexer exists).

**Secret key only (admin, Phase 2):** `PUT /admin/dtfs/:vault/metadata`, `GET /admin/users`, key rotation.

**Ops CLI (no admin UI in v1):** `pnpm cli create-project`, `pnpm cli create-key --project --type pk|sk` (prints the key once).

## Repo layout

```
pnpm-workspace.yaml
packages/sdk/          # @zenoindex/sdk (see above)
apps/api/
  src/
    index.ts           # boot: env (zod) → db → app.listen
    app.ts             # Hono app, middleware order: requestId → cors → apiKey → rateLimit → routes → errorHandler
    env.ts             # zod-validated env, fail fast
    errors.ts          # PlatformError + envelope (from infra packages/errors)
    decimal.ts         # from infra packages/decimal
    db/ client.ts, migrate.ts, migrations/0001_init.sql
    middleware/ apiKey.ts, session.ts, idempotency.ts, rateLimit.ts
    chain.ts           # viem public client for 4663 (uses @zenoindex/sdk)
    routes/ auth.ts, dtfs.ts, trade.ts, operations.ts, portfolio.ts, meta.ts (chains/assets/kyc)
    cli.ts
  test/ *.test.ts      # vitest; app.request() route tests; SDK read tests against mainnet RPC (read-only)
```

## Phases

### Phase 0 — Demo slice (tonight, ~8h)
Goal: on a phone, connect wallet → sign in → see a basket → buy → see position → sell → get USDG back.

| # | Task | Est. |
|---|---|---|
| 0.1 | Scaffold pnpm workspace (`packages/sdk`, `apps/api`; tsconfig, Hono, zod, viem, postgres, vitest, docker-compose for Postgres) | 0.5h |
| 0.2 | `@zenoindex/sdk`: `gen-abis` from zenoindex-evm @ `7663cc6` (`forge build` in a temp git worktree) → `abis.ts`; mainnet constants; reads + tx builders | 1h |
| 0.3 | Migration 0001 + migrate runner + `cli create-project/create-key` | 0.75h |
| 0.4 | Middleware: API key (hash lookup, pk/sk scope), session, error envelope, CORS | 0.75h |
| 0.5 | SIWE nonce/verify + me/terms/profile/logout | 1h |
| 0.6 | chains / assets / dtfs / dtfs/:id / kyc stub (multicall reads) | 1.25h |
| 0.7 | buy/prepare, redeem/prepare state machine, operations submit/confirm/fail with receipt check | 1.5h |
| 0.8 | portfolio from on-chain balances | 0.5h |
| 0.9 | Deploy backend somewhere reachable (Railway/Render/Fly + managed Postgres), create org/project/pk/sk via CLI | 0.5h |
| 0.10 | Mobile app: `x-api-key` header (`EXPO_PUBLIC_API_KEY`), add Robinhood mainnet 4663 to wagmi/AppKit (drop anvil 31337 default), sign-in → AppKit connect + SIWE, redeem step loop in `TradePanel.tsx` | 1.5h |

**Blocking for a live buy/sell demo — needs the evm team on mainnet (super-admin `0x44BC…7e18`), in this order:**
1. Deploy `UniswapV4Adapter` (script exists on the branch) → `adapter.setAuthorizedCaller(factory, true)` → `factory.setSwapRouter(adapter)`. `createVault` reverts `NoRouter` without this.
2. `createAsset(USDG)` (every vault needs a USDG slot; USDG is priced 1:1 automatically).
3. **Smallest demo vault:** `createVault` with **100% USDG** (`assetIds=[usdgId]`, `allocationBps=[10000]`, `redeemFeeBps ≥ 50`, name/symbol). Buy = `deposit`; sell = `requestRedeem` → `claim` (the USDG leg goes straight to escrow — **no swaps, no pools, no price keeper needed**).
4. `genesisDeposit(baseline)` (seeds 1 USDG) so `deposit` stops reverting `GenesisNotSeeded`.
5. Demo wallet holds a few real USDG + ETH for gas.
A real multi-asset basket additionally needs: `createAsset` + `setPrice` per token, a daily price keeper, `setPool` per pair, swap paths, and the manager swapping deposits into assets.

Cut from Phase 0 (shown as "coming soon"/unavailable): KYC, performance chart, indexer-backed history, usage metering, admin endpoints.

### Phase 1 — Hardening (week 1)
Idempotency table wired on all POSTs · rate limit per key (Postgres/Redis) · operation monitor worker (submitted → confirmed/failed/dropped with N confirmations) · session expiry cleanup · request logging with redaction · OpenAPI from zod schemas · mainnet config (4663) once the evm team has created assets, prices, router and vaults.

### Phase 2 — Productize (API-key business)
Usage metering per key (daily counters → billing) · secret-key admin API (metadata, users, key rotation) · webhooks (operation confirmed, deposit, redeem) · per-key origin/bundle allowlist · KYC (Didit) keyed by user+session id with HMAC-verified webhook.

### Phase 3 — Indexer
Ponder indexing from block **83,351,081** (mainnet): factory `VaultCreated` (indexed clone → dynamic vault sources), `AssetCreated`, `PriceSet`, `RouterUpdated`; adapter `PoolRegistered` (→ `swap_paths`); vault events (**no indexed params** → filter by clone address + topic0, decode data); ShareToken `Transfer` (indexed → holders/positions). Outputs: transactions, NAV snapshots (performance chart), cost basis, holders, `requestedAt` for `forceSettleRedeem` (only available from the `RequestRedeem` event).

### Reference: contract facts the code depends on
- Share token: 6 decimals; USDG 6 decimals. Share price (human) = `totalNav / totalShares`.
- `previewDeposit` returns `sharesOut = 0` when genesis isn't done or the cap is full → treat as "not tradable".
- `requestRedeem` burns shares directly (no share approval needed); one open redeem per user.
- `getRedeemAssetAmount(user, i)` has no bounds check → only loop `i < getRedeemState(user).numAssets`.
- Stale price blocks `deposit`, `totalNav` and redeem swaps; `claim`/`claimInKind` still work.
- `setVaultEmergencyLock` emits no event → poll `adminLocked()`.

## Dependencies on the zenoindex-evm team
Mainnet is recorded on branch `feat/zenoindex/phase-1-hardening` (commit `e23f297`, code at `7663cc6`), not on `main`. Factory `0xd00abbc1d1555a173c5081b2204579b057b05378`, AccessMaster `0x9e0d0f667307c8a3512caf5c50efeb0eddfbb78d`, Vault impl `0xe76f73be98f7002fc8b68466c5a8780d993f0115`, USDG `0x5fc5360d0400a0fd4f2af552add042d716f1d168`. Live state 2026-10-10: 0 vaults, 0 assets, router unset.
1. Merge/tag `7663cc6` so main = mainnet.
2. Deploy `UniswapV4Adapter`, `setSwapRouter`, register pools.
3. `createAsset` for basket tokens + daily `setPrice` keeper (else every deposit/redeem reverts `StalePrice`).
4. `createVault` (with a USDG slot) + `genesisDeposit` + manager bot for `swapUsdcToAsset`.
5. Swap path per asset → USDG (redeem needs it; not stored on-chain).
6. Super-admin → multisig.

## Verification
- `pnpm test` — unit (SIWE verify incl. replay rejected, api-key scoping pk vs sk, operation transitions, decimal math, redeem state machine with mocked reads, SDK calldata builders decode back to the right function/args) + route tests via `app.request()`.
- Read-only mainnet checks (no funds): SDK `listVaults/getVault/getAssets` against the live factory; `buy/prepare` returns calldata that `eth_call`-simulates without revert for a funded address (once a vault exists).
- Live, small amounts (once the demo vault exists): phone → SIWE login → buy 1 USDG → portfolio shows shares → sell → USDG back. Check every operation ends `confirmed` and matches the tx on the explorer.

## Risks
- **Mainnet has 0 vaults / 0 assets / no router today.** Without evm-team steps 1–4 above, the demo can show login + an empty list only. Ask for the 100%-USDG vault today.
- Every demo trade is **real money** on mainnet — use tiny amounts and a dedicated demo wallet.
- Reown email/embedded wallets must support chain 4663; verify early. Fallback: an external wallet (MetaMask mobile with Robinhood mainnet added).
- Multi-asset redeem needs swap paths + pools from the evm team; until then, sell for those vaults uses `claimInKind`.
- Publishable keys are visible in the app binary by design — they must never unlock admin or another user's data.
