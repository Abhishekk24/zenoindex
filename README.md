# zenoIndex-backend

API-key backend for ZenoIndex DTFs on **Robinhood Chain mainnet (4663)**. First client: `zenoIndex-mobile-app`.
Plan and roadmap: [docs/IMPLEMENTATION_PLAN.md](docs/IMPLEMENTATION_PLAN.md).

| Package | What |
|---|---|
| `packages/sdk` (`@zenoindex/sdk`) | Generated contract ABIs (from zenoindex-evm@550d0a2, incl. FeeEscrow), mainnet addresses, typed reads, tx builders |
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

**CI/CD (same flow as IMPACTMAX):** `.github/workflows/production.yml` — on push to `main`: Vault → build `Dockerfile` → push `ghcr.io/ans-mishra/zenoindex-backend:prod` → SSH → `docker run --env-file .env` behind Traefik → waits for the container health check. Before the first run: create the Vault paths `zenoindex-backend/production/app` (the env keys below) and `…/infra` (GHCR_USERNAME, GHCR_TOKEN, SERVER_HOST, SERVER_USERNAME, SSH_PORT, REMOTE_SERVER_KEY), and set the repo variable `API_HOST`.

**Manually:** `docker build -t zenoindex-backend . && docker run -p 8787:8787 --env-file .env zenoindex-backend`, or on any Node 22 host `pnpm install --frozen-lockfile --prod && pnpm --filter @zenoindex/api start`.

Needs Postgres 13+. Migrations run on boot. Health check: `GET /health`.

| Env | Required | |
|---|---|---|
| `DATABASE_URL` | ✓ | Postgres connection string. Managed DBs with their own CA (e.g. Vultr): download the CA cert from the provider and use `?sslmode=verify-full&sslrootcert=/path/to/ca.crt` — plain `sslmode=require` fails with `SELF_SIGNED_CERT_IN_CHAIN`. The user needs CONNECT on the database and CREATE on schema `public` (tables are created on boot). |
| `DATABASE_CA_CERT` | | PEM CA cert of the DB server (private-CA managed Postgres, e.g. Vultr), `\n`-escaped on one line. Use instead of `sslrootcert` when the cert can't be a file (Docker/Vault). |
| `PUBLIC_URL` | with seed | public https URL of this API; its host is the sign-in (SIWE) domain |
| `NODE_ENV` | | `production` → `Secure` cookies |
| `PORT` | | default 8787 |
| `RPC_URL` | | Robinhood mainnet RPC (default public RPC); boot fails if it isn't chain 4663 |
| `DIDIT_API_KEY`, `DIDIT_WORKFLOW_ID` | for KYC | Didit (same provider as cyrene-web). Without them, starting KYC returns 503 "not set up yet". |
| `DIDIT_WEBHOOK_SECRET` | | enables `POST /webhooks/didit` (HMAC-verified). Optional: status is also pulled from Didit when the app checks it. |
| `DIDIT_CALLBACK_URL` | | where Didit sends the browser after verification |
| `PRIVY_APP_ID`, `PRIVY_APP_SECRET` | for mobile sign-in | Privy app (dashboard › App settings › Basics). `POST /auth/privy` verifies Privy access tokens with them; without them it returns 503. The secret never goes in the mobile app. |
| `DEMO_STATS` | default `true` | Baskets with fewer than 2 real daily NAV snapshots get a demo 30-day NAV history (flagged `demo: true`; the app labels it). Set `false` to turn off. A worker snapshots every basket's NAV at boot and every 24h. |
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
