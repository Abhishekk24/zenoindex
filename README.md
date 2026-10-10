# zenoIndex-backend

API-key backend for ZenoIndex DTFs on **Robinhood Chain mainnet (4663)**. First client: `zenoIndex-mobile-app`.
Plan and roadmap: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| Package | What |
|---|---|
| `packages/sdk` (`@zenoindex/sdk`) | Generated contract ABIs (from zenoindex-evm@7663cc6), mainnet addresses, typed reads, tx builders |
| `apps/api` (`@zenoindex/api`) | Hono HTTP API at `/api/v1`: API keys, SIWE login, DTF reads, buy/sell tx prep, order tracking |

## Run locally

```bash
pnpm install
cp apps/api/.env.example apps/api/.env     # set DATABASE_URL (hosted Postgres), then load it: `set -a; . apps/api/.env; set +a`
pnpm --filter @zenoindex/api cli create-org --name "Cyrene"
pnpm --filter @zenoindex/api cli create-project --org <orgId> --name "ZenoIndex Mobile" --domain app.zenoindex.xyz --uri https://app.zenoindex.xyz
pnpm --filter @zenoindex/api cli create-key --project <projectId> --type publishable --name mobile   # → EXPO_PUBLIC_API_KEY
pnpm --filter @zenoindex/api cli create-key --project <projectId> --type secret --name ops         # → keep in a password manager
pnpm --filter @zenoindex/api dev           # http://localhost:8787
curl -H "x-api-key: pk_live_…" http://localhost:8787/api/v1/dtfs
```

## Deploy

Any Node 22 host: `pnpm install --frozen-lockfile --prod && pnpm --filter @zenoindex/api start`.
Needs Postgres 13+. Migrations run on boot. Health check: `GET /health`.

| Env | Required | |
|---|---|---|
| `DATABASE_URL` | ✓ | Postgres connection string |
| `PUBLIC_URL` | with seed | public https URL of this API; its host is the sign-in (SIWE) domain |
| `NODE_ENV` | | `production` → `Secure` cookies |
| `PORT` | | default 8787 |
| `RPC_URL` | | Robinhood mainnet RPC (default public RPC); boot fails if it isn't chain 4663 |
| `SEED_PROJECT_NAME`, `SEED_PUBLISHABLE_KEY_SHA256`, `SEED_SECRET_KEY_SHA256` | | first-boot project + keys, as SHA-256 hashes only; idempotent on every boot |

## Keys

- `pk_live_…` publishable: ships inside the app. Public reads + login only; every user action also needs that user's session.
- `sk_live_…` secret: server-to-server/admin only. Never in an app or in git.
- Only SHA-256 hashes of keys and session tokens are stored.

## API (all routes need `x-api-key`)

| Route | Session | |
|---|---|---|
| `POST /auth/siwe/nonce` `{walletAddress, chainId?}` | – | returns the EIP-4361 `message` to sign (nonce is single-use, 5 min) |
| `POST /auth/siwe/verify` `{message, signature}` | – | `{user, token}` + `Set-Cookie: dtf_session` |
| `GET /auth/me` · `POST /auth/accept-terms` · `POST /auth/profile` · `POST /auth/logout` | ✓ (me: optional) | |
| `GET /chains` · `GET /assets` · `GET /dtfs` · `GET /dtfs/:id` · `GET /compliance/kyc/:wallet/status` | – | read straight from mainnet (10 s cache) |
| `POST /dtfs/:id/buy/prepare` `{amount, recipient, slippageBps?}` | ✓ | `deposit` tx; the app approves USDG to `transaction.to` first |
| `POST /dtfs/:id/redeem/prepare` `{shares?, recipient, inKind?}` | ✓ | **next** sell step; repeat until `finalStep: true` |
| `POST /operations/:id/submit\|confirm\|fail` · `GET /operations/:id` | ✓ | confirm checks the mined tx matches the prepared one |
| `GET /wallets/:wallet/portfolio` · `GET /dtfs/:id/transactions` | ✓ (own wallet) | |

Session: `Authorization: Bearer <token>` or `Cookie: dtf_session=<token>`. Errors: `{ error: { status, code, message, retryable } }`.

## Tests

```bash
pnpm test               # offline: PGlite + fake RPC
ZENO_LIVE=1 pnpm test   # + read-only checks against mainnet
pnpm typecheck
```
