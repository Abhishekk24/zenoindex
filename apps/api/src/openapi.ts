// OpenAPI 3.1 description of the public API, served at /openapi.json and rendered at /docs.
// test/openapi.test.ts fails if a route is added to the app without being documented here.

const s = (type: string, extra: Record<string, unknown> = {}) => ({ type, ...extra });
const str = (description?: string, extra: Record<string, unknown> = {}) => s("string", { ...(description && { description }), ...extra });
const ref = (name: string) => ({ $ref: `#/components/schemas/${name}` });
const json = (schema: unknown) => ({ "application/json": { schema } });
const ok = (schema: unknown, description = "OK") => ({ description, content: json(schema) });
const body = (schema: unknown) => ({ required: true, content: json(schema) });
const errors = (...codes: number[]) =>
  Object.fromEntries(codes.map((c) => [String(c), { $ref: `#/components/responses/E${c}` }]));
const pathParam = (name: string, description: string) => ({ name, in: "path", required: true, schema: str(), description });

const KEY = [{ apiKey: [] }];
const KEY_AND_SESSION = [{ apiKey: [], session: [] }];

const userResponse = s("object", { required: ["user"], properties: { user: ref("User") } });
const operationTag = "Orders";

const managerPrepare = (summary: string, description: string, required: string[], properties: Record<string, unknown>) => ({
  post: {
    tags: ["Manager"],
    summary,
    description,
    security: KEY_AND_SESSION,
    parameters: [pathParam("id", "Vault address")],
    requestBody: body(s("object", { required, properties })),
    responses: { 200: ok(ref("TxDraft")), ...errors(400, 401, 403, 404, 409) },
  },
});
const slippage = s("integer", { default: 100, maximum: 5000, description: "Cushion below the factory's oracle floor (`swapFloor`) for `minOut`" });

export const openapi = {
  openapi: "3.1.0",
  info: {
    title: "ZenoIndex API",
    version: "0.1.0",
    description: [
      "API-key backend for ZenoIndex DTF baskets on **Robinhood Chain mainnet (chainId 4663)**.",
      "",
      "**Auth.** Every `/api/v1` request needs the project's API key in `x-api-key`.",
      "User actions also need a session token from SIWE sign-in, sent as `Authorization: Bearer <token>` (or the `dtf_session` cookie).",
      "Publishable keys (`pk_live_…`) are safe to ship in an app; secret keys (`sk_live_…`) are server-side only.",
      "",
      "**Money.** Decimal amounts are strings (`\"1.5\"`); `*Raw` fields are integer base units as strings. USDG and basket shares have 6 decimals.",
      "",
      "**Errors.** Every error is `{ error: { status, code, message, retryable } }`; `message` is safe to show to users.",
      "",
      "**Trades.** The backend never holds user keys: `prepare` returns an unsigned transaction for the user's wallet to sign, then the app reports it via `/operations/{id}/submit` and `/confirm`; confirm is verified on-chain.",
    ].join("\n"),
  },
  servers: [{ url: "https://api.zenoindex.com", description: "Production" }],
  tags: [
    { name: "System" },
    { name: "Auth", description: "Sign-In with Ethereum (EIP-4361) and onboarding" },
    { name: "Baskets", description: "Read-only basket data, read live from the chain" },
    { name: "Trading", description: "Unsigned transactions for buying and selling" },
    { name: operationTag, description: "Tracking a prepared transaction through submit and confirm" },
    { name: "Portfolio" },
    { name: "KYC", description: "Identity verification via Didit" },
    { name: "Manager", description: "Vault-manager dashboard and transactions. Only the basket's `vaultManager` or a vault operator; anyone else gets 403 `not_manager`. Prepared transactions are tracked through `/operations/{id}` like trades." },
  ],
  components: {
    securitySchemes: {
      apiKey: { type: "apiKey", in: "header", name: "x-api-key", description: "Project API key (`pk_live_…` or `sk_live_…`)" },
      session: { type: "http", scheme: "bearer", description: "Session token from `POST /api/v1/auth/siwe/verify`" },
    },
    responses: {
      E400: { description: "Validation failed", content: json(ref("Error")) },
      E401: { description: "Missing/invalid API key, or not signed in", content: json(ref("Error")) },
      E403: { description: "Wallet doesn't match the signed-in user, or doesn't manage the basket (`not_manager`)", content: json(ref("Error")) },
      E404: { description: "Not found", content: json(ref("Error")) },
      E409: { description: "Conflict (not tradable, wrong state, tx mismatch, no swap route)", content: json(ref("Error")) },
      E502: { description: "Upstream provider failed", content: json(ref("Error")) },
      E503: { description: "Feature not configured", content: json(ref("Error")) },
    },
    schemas: {
      Error: s("object", {
        required: ["error"],
        properties: {
          error: s("object", {
            required: ["status", "code", "message", "retryable"],
            properties: { status: s("integer"), code: str(undefined, { examples: ["validation_failed"] }), message: str("Human-readable; safe to show"), retryable: s("boolean") },
          }),
        },
      }),
      Address: str("0x-prefixed address, lowercase in responses", { pattern: "^0x[0-9a-fA-F]{40}$" }),
      User: s("object", {
        properties: {
          id: str(),
          email: s("null"),
          displayName: str(undefined, { nullable: true }),
          firstName: str(undefined, { nullable: true }),
          lastName: str(undefined, { nullable: true }),
          country: str("ISO-3166 alpha-2", { nullable: true }),
          walletAddress: ref("Address"),
          wallets: s("array", { items: s("object", { properties: { address: ref("Address"), chainId: s("integer"), isPrimary: s("boolean") } }) }),
          twoFactorEnabled: s("boolean"),
          termsAcceptedAt: str(undefined, { format: "date-time", nullable: true }),
          privacyAcceptedAt: str(undefined, { format: "date-time", nullable: true }),
          createdAt: str(undefined, { format: "date-time" }),
        },
      }),
      Chain: s("object", { properties: { chainId: s("integer", { examples: [4663] }), name: str(), network: str(), rpcUrl: str("Public RPC"), explorerUrl: str() } }),
      Asset: s("object", {
        properties: {
          id: ref("Address"),
          contractAddress: ref("Address"),
          chainId: s("integer"),
          symbol: str(undefined, { examples: ["NVDA"] }),
          name: str(),
          decimals: s("integer"),
          underlyingTransferPolicy: str(undefined, { enum: ["open"] }),
        },
      }),
      Dtf: s("object", {
        description: "A basket (vault). `id` is the vault address.",
        properties: {
          id: ref("Address"),
          chainId: s("integer"),
          name: str(),
          symbol: str(),
          manager: ref("Address"),
          contractAddress: { ...ref("Address"), description: "Share token" },
          baseAssetId: { ...ref("Address"), description: "USDG" },
          baseAssetDecimals: s("integer"),
          shareDecimals: s("integer"),
          weights: s("array", { items: s("object", { properties: { assetId: ref("Address"), weightBps: s("integer") } }) }),
          nav: str("Total NAV in USDG (omitted when unreadable, e.g. stale price)"),
          sharePrice: str("USDG per share", { examples: ["1.0234"] }),
          aum: str("USDG"),
          fees: s("object", { properties: { entryBps: s("integer"), exitBps: s("integer"), managementBps: s("integer") } }),
          strategyType: str(undefined, { enum: ["standard"] }),
          asOf: str(undefined, { format: "date-time" }),
          lifecycle: str("`coming_soon` when paused, before genesis, in emergency, or NAV unreadable", { enum: ["active", "coming_soon"] }),
          totalSupplyRaw: str(),
        },
      }),
      ReadModel: s("object", { properties: { status: str(undefined, { enum: ["available", "unavailable"] }), items: s("array") } }),
      DtfDetail: {
        allOf: [
          ref("Dtf"),
          s("object", {
            properties: {
              readModels: s("object", {
                properties: {
                  holdings: { ...ref("ReadModel"), description: "Items: `{ assetId, quantityRaw, targetWeightBps }`" },
                  performance: ref("ReadModel"),
                  performanceDeltas: ref("ReadModel"),
                  recentTransactions: ref("ReadModel"),
                  corporateActions: ref("ReadModel"),
                },
              }),
            },
          }),
        ],
      },
      Operation: s("object", {
        properties: {
          id: str(undefined, { format: "uuid" }),
          action: str(undefined, {
            enum: [
              "buy", "redeem_request", "redeem_swap", "redeem_claim", "redeem_claim_in_kind",
              "manager_genesis", "manager_deploy", "manager_rebalance", "manager_allocations", "manager_pause", "manager_write_off", "manager_reactivate", "manager_fee_recipient",
            ],
          }),
          status: str(undefined, { enum: ["draft_prepared", "submitted", "confirmed", "failed"] }),
          txHash: str(undefined, { nullable: true }),
          resourceId: { ...ref("Address"), description: "Vault address" },
          walletAddress: ref("Address"),
          failureReason: str(undefined, { nullable: true }),
          createdAt: str(undefined, { format: "date-time" }),
          updatedAt: str(undefined, { format: "date-time" }),
          submittedAt: str(undefined, { format: "date-time", nullable: true }),
          confirmedAt: str(undefined, { format: "date-time", nullable: true }),
        },
      }),
      TxDraft: s("object", {
        description: "Unsigned transaction for the user's wallet. `requestId` is the operation id.",
        properties: {
          action: str(),
          requestId: str(undefined, { format: "uuid" }),
          operation: ref("Operation"),
          transaction: s("object", { properties: { to: ref("Address"), data: str("Calldata"), value: str("Wei, decimal string"), chainId: s("integer") } }),
          data: s("object", { description: "Quote (buy): `entryFee`, `estimatedShares` (raw). Manager genesis: `approveToken`, `approveAmountRaw`", additionalProperties: str() }),
        },
      }),
      RedeemDraft: {
        allOf: [
          ref("TxDraft"),
          s("object", {
            properties: {
              step: str(undefined, { enum: ["request", "swap", "claim", "claimInKind"] }),
              finalStep: s("boolean", { description: "false → call prepare again after this one confirms" }),
              stepsRemaining: s("integer", { nullable: true }),
            },
          }),
        ],
      },
      ManagerDtf: {
        allOf: [
          ref("Dtf"),
          s("object", {
            properties: {
              feeRecipient: ref("Address"),
              status: s("object", { properties: { paused: s("boolean"), adminLocked: s("boolean"), emergency: s("boolean", { description: "Protocol-wide" }), genesisDone: s("boolean") } }),
              totalPendingUsdc: str("USDG deposited but not yet invested"),
              redeemQueue: s("object", { properties: { activeCount: s("integer"), escrowUsdc: str("USDG owed to sellers") } }),
              slots: s("array", {
                items: s("object", {
                  properties: {
                    index: s("integer", { description: "`slotIndex` for deploy/rebalance" }),
                    assetId: { ...ref("Address"), description: "Asset token" },
                    symbol: str(undefined, { nullable: true }),
                    targetBps: s("integer"),
                    currentBps: s("integer", { nullable: true, description: "Weight of the free balance in the free NAV, as executeRebalance sees it; null on a stale price" }),
                    driftBps: s("integer", { nullable: true, description: "currentBps - targetBps" }),
                    pendingDeployUsdc: str("USDG waiting for `deploy`"),
                    reservedRaw: str("Held for open sales"),
                    balanceRaw: str(),
                    valueUsdc: str("USDG value of the free balance", { nullable: true }),
                    pendingWriteOff: s("boolean"),
                    pendingReactivate: s("boolean"),
                  },
                }),
              }),
              actions: s("array", {
                description: "To-do inbox: `genesis` before the first seed, `deploy` per slot with pending USDG, `rebalance` per slot drifting more than 50 bps",
                items: s("object", { properties: { kind: str(undefined, { enum: ["genesis", "deploy", "rebalance"] }), slotIndex: s("integer"), amountUsdc: str(), driftBps: s("integer") } }),
              }),
            },
          }),
        ],
      },
      Kyc: s("object", {
        properties: {
          wallet: ref("Address"),
          provider: str(undefined, { enum: ["didit"] }),
          status: str(undefined, { enum: ["approved", "declined", "pending", "not_started"] }),
          approved: s("boolean"),
          sessionId: str(undefined, { nullable: true }),
          rawStatus: str("Didit status, e.g. `In Review`", { nullable: true }),
        },
      }),
    },
  },
  paths: {
    "/health": { get: { tags: ["System"], summary: "Liveness", security: [], responses: { 200: ok(s("object", { properties: { ok: s("boolean") } })) } } },
    "/webhooks/didit": {
      post: {
        tags: ["KYC"],
        summary: "Didit webhook (called by Didit)",
        description: "No API key. Authenticated by `X-Signature-V2` (HMAC-SHA256 of the canonical body) and the signed body `timestamp` (±300 s). Events are applied once per `event_id`.",
        security: [],
        parameters: [{ name: "x-signature-v2", in: "header", required: true, schema: str() }],
        requestBody: body(s("object", { properties: { event_id: str(), session_id: str(), status: str(), vendor_data: str(), timestamp: s("integer") } })),
        responses: { 200: ok(s("object", { properties: { ok: s("boolean") } })), ...errors(400, 401, 503) },
      },
    },

    "/api/v1/auth/siwe/nonce": {
      post: {
        tags: ["Auth"],
        summary: "Start sign-in: get the message to sign",
        description: "Returns a single-use nonce (5 min) and the exact EIP-4361 message. The wallet signs it with `personal_sign`.",
        security: KEY,
        requestBody: body(s("object", { required: ["walletAddress"], properties: { walletAddress: ref("Address"), chainId: s("integer", { examples: [4663] }) } })),
        responses: { 200: ok(s("object", { properties: { nonce: str(), message: str(), expiresInSeconds: s("integer") } })), ...errors(400, 401) },
      },
    },
    "/api/v1/auth/siwe/verify": {
      post: {
        tags: ["Auth"],
        summary: "Finish sign-in: verify the signature, get a session",
        description: "Consumes the nonce (replays fail). EOA signatures are checked offline; smart-contract wallets via ERC-1271/6492. Creates the user on first sign-in. Also sets the `dtf_session` cookie.",
        security: KEY,
        requestBody: body(s("object", { required: ["message", "signature"], properties: { message: str(), signature: str("0x…") } })),
        responses: { 200: ok(s("object", { properties: { user: ref("User"), token: str("Session token for `Authorization: Bearer`") } })), ...errors(400, 401) },
      },
    },
    "/api/v1/auth/privy": {
      post: {
        tags: ["Auth"],
        summary: "Sign in with Privy (email, Google or wallet), get a session",
        description:
          "Verifies a Privy access token server-side and signs in the Privy user's wallet: their embedded wallet (email / Google), else the external wallet they signed in with (Privy SIWE). Creates the user on first sign-in. 409 `wallet_not_ready` while Privy is still creating the wallet (retry). 503 when Privy isn't configured. Also sets the `dtf_session` cookie.",
        security: KEY,
        requestBody: body(s("object", { required: ["accessToken"], properties: { accessToken: str("Privy access token (`getAccessToken()`)") } })),
        responses: { 200: ok(s("object", { properties: { user: ref("User"), token: str("Session token for `Authorization: Bearer`") } })), ...errors(400, 401, 409, 503) },
      },
    },
    "/api/v1/auth/me": {
      get: { tags: ["Auth"], summary: "Current user (`user: null` when signed out)", security: [{ apiKey: [] }, { apiKey: [], session: [] }], responses: { 200: ok(s("object", { properties: { user: { oneOf: [ref("User"), s("null")] } } })), ...errors(401) } },
    },
    "/api/v1/auth/accept-terms": {
      post: { tags: ["Auth"], summary: "Accept terms and privacy policy", security: KEY_AND_SESSION, requestBody: body(s("object", { required: ["terms", "privacy"], properties: { terms: s("boolean", { const: true }), privacy: s("boolean", { const: true }) } })), responses: { 200: ok(userResponse), ...errors(400, 401) } },
    },
    "/api/v1/auth/profile": {
      post: {
        tags: ["Auth"],
        summary: "Save profile",
        security: KEY_AND_SESSION,
        requestBody: body(s("object", { required: ["firstName", "lastName", "country"], properties: { firstName: str(), lastName: str(), country: str("2-letter code", { examples: ["IN"] }), displayName: str() } })),
        responses: { 200: ok(userResponse), ...errors(400, 401) },
      },
    },
    "/api/v1/auth/logout": {
      post: { tags: ["Auth"], summary: "End the session", security: KEY_AND_SESSION, responses: { 200: ok(s("object", { properties: { ok: s("boolean") } })), ...errors(401) } },
    },

    "/api/v1/chains": { get: { tags: ["Baskets"], summary: "Supported chain (Robinhood mainnet)", security: KEY, responses: { 200: ok(s("object", { properties: { items: s("array", { items: ref("Chain") }) } })), ...errors(401) } } },
    "/api/v1/assets": { get: { tags: ["Baskets"], summary: "Registered assets (always includes USDG)", security: KEY, responses: { 200: ok(s("object", { properties: { items: s("array", { items: ref("Asset") }) } })), ...errors(401) } } },
    "/api/v1/dtfs": { get: { tags: ["Baskets"], summary: "All baskets", description: "Read live from the factory (cached ~10 s).", security: KEY, responses: { 200: ok(s("object", { properties: { items: s("array", { items: ref("Dtf") }) } })), ...errors(401) } } },
    "/api/v1/dtfs/{id}": {
      get: { tags: ["Baskets"], summary: "One basket with holdings", security: KEY, parameters: [pathParam("id", "Vault address")], responses: { 200: ok(ref("DtfDetail")), ...errors(401, 404) } },
    },
    "/api/v1/dtfs/{id}/transactions": {
      get: {
        tags: ["Portfolio"],
        summary: "Your orders in this basket",
        description: "The signed-in user's own transactions placed through this API (last 50).",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Vault address")],
        responses: { 200: ok(s("object", { properties: { items: s("array", { items: s("object") }) } })), ...errors(401, 404) },
      },
    },

    "/api/v1/dtfs/{id}/buy/prepare": {
      post: {
        tags: ["Trading"],
        summary: "Prepare a buy (vault `deposit`)",
        description: "The wallet must first approve `amount` USDG to `transaction.to` (the vault). `recipient` must be the signed-in wallet.",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Vault address")],
        requestBody: body(s("object", { required: ["amount", "recipient"], properties: { amount: str("USDG, up to 6 decimals", { examples: ["10.5"] }), recipient: ref("Address"), slippageBps: s("integer", { default: 100, maximum: 5000 }) } })),
        responses: { 200: ok(ref("TxDraft")), ...errors(400, 401, 403, 404, 409) },
      },
    },
    "/api/v1/dtfs/{id}/redeem/prepare": {
      post: {
        tags: ["Trading"],
        summary: "Prepare the next sell step",
        description:
          "Selling is several transactions: `requestRedeem` → `swapAssetToUsdc` per basket asset → `claim`. Each call returns the **next** one; repeat prepare → sign → confirm until `finalStep` is true. `shares` is required only for the first step. With `inKind: true` the swaps are skipped and the sale settles with `claimInKind` (basket tokens instead of USDG).",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Vault address")],
        requestBody: body(s("object", { required: ["recipient"], properties: { shares: str("Shares to sell, up to 6 decimals"), recipient: ref("Address"), owner: ref("Address"), inKind: s("boolean", { default: false }) } })),
        responses: { 200: ok(ref("RedeemDraft")), ...errors(400, 401, 403, 404, 409) },
      },
    },

    "/api/v1/operations/{id}": {
      get: { tags: [operationTag], summary: "Get an order", security: KEY_AND_SESSION, parameters: [pathParam("id", "Operation id (`requestId`)")], responses: { 200: ok(ref("Operation")), ...errors(401, 404) } },
    },
    "/api/v1/operations/{id}/submit": {
      post: {
        tags: [operationTag],
        summary: "Report the broadcast tx hash",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Operation id")],
        requestBody: body(s("object", { required: ["txHash"], properties: { txHash: str("0x…64 hex") } })),
        responses: { 200: ok(ref("Operation")), ...errors(400, 401, 404, 409) },
      },
    },
    "/api/v1/operations/{id}/confirm": {
      post: {
        tags: [operationTag],
        summary: "Settle from the chain",
        description: "The backend fetches the receipt and checks the mined tx is exactly the prepared one (sender, target, calldata). Status becomes `confirmed` or `failed` from the receipt — not from the client. Not mined yet → stays `submitted`.",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Operation id")],
        requestBody: body(s("object", { required: ["txHash"], properties: { txHash: str() } })),
        responses: { 200: ok(ref("Operation")), ...errors(400, 401, 404, 409) },
      },
    },
    "/api/v1/operations/{id}/fail": {
      post: {
        tags: [operationTag],
        summary: "Report a failure / cancellation",
        description: "With `txHash`, the chain decides (same as confirm). Without it, a draft is cancelled (e.g. user rejected in the wallet).",
        security: KEY_AND_SESSION,
        parameters: [pathParam("id", "Operation id")],
        requestBody: body(s("object", { properties: { txHash: str(), reason: str() } })),
        responses: { 200: ok(ref("Operation")), ...errors(400, 401, 404, 409) },
      },
    },

    "/api/v1/wallets/{wallet}/portfolio": {
      get: {
        tags: ["Portfolio"],
        summary: "Positions of the signed-in wallet",
        security: KEY_AND_SESSION,
        parameters: [pathParam("wallet", "Must be the signed-in wallet")],
        responses: { 200: ok(s("object", { properties: { wallet: ref("Address"), positions: s("array", { items: s("object", { properties: { dtfId: ref("Address"), shares: str("Raw"), value: str("USDG"), asOf: str() } }) }) } })), ...errors(401, 403) },
      },
    },

    "/api/v1/compliance/kyc/{wallet}/status": {
      get: {
        tags: ["KYC"],
        summary: "KYC status",
        description: "Returns the real status only for the signed-in user's own wallet (refreshed from Didit while open); any other wallet gets `not_started`.",
        security: [{ apiKey: [] }, { apiKey: [], session: [] }],
        parameters: [pathParam("wallet", "Wallet address")],
        responses: { 200: ok(ref("Kyc")), ...errors(401) },
      },
    },
    "/api/v1/eligibility/kyc/start": {
      post: {
        tags: ["KYC"],
        summary: "Start identity verification",
        description: "Creates a Didit session and returns its URL to open in a browser.",
        security: KEY_AND_SESSION,
        requestBody: body(s("object", { required: ["wallet"], properties: { wallet: ref("Address") } })),
        responses: { 200: ok(s("object", { properties: { sessionId: str(), url: str(), status: str() } })), ...errors(400, 401, 403, 502, 503) },
      },
    },

    "/api/v1/manager/dtfs": {
      get: { tags: ["Manager"], summary: "Baskets the signed-in wallet manages", security: KEY_AND_SESSION, responses: { 200: ok(s("object", { properties: { items: s("array", { items: ref("Dtf") }) } })), ...errors(401) } },
    },
    "/api/v1/manager/dtfs/{id}": {
      get: { tags: ["Manager"], summary: "Manager dashboard", security: KEY_AND_SESSION, parameters: [pathParam("id", "Vault address")], responses: { 200: ok(ref("ManagerDtf")), ...errors(401, 403, 404) } },
    },
    "/api/v1/manager/dtfs/{id}/genesis/prepare": managerPrepare(
      "Seed the basket (`genesisDeposit`)",
      "Mints the first shares for 1 USDG at `baselineSharePrice`. The wallet must first approve `data.approveAmountRaw` of `data.approveToken` (USDG) to `transaction.to`. 409 when already seeded or not active (paused, admin-locked, emergency).",
      ["baselineSharePrice"],
      { baselineSharePrice: str("USDG per share, 0.00001 to 100000, up to 9 decimals", { examples: ["1"] }) },
    ),
    "/api/v1/manager/dtfs/{id}/deploy/prepare": managerPrepare(
      "Invest a slot's pending deposits (`swapUsdcToAsset`)",
      "Swaps the slot's whole pending USDG into the asset. 409 when nothing is pending or the basket isn't active.",
      ["slotIndex"],
      { slotIndex: s("integer"), slippageBps: slippage },
    ),
    "/api/v1/manager/dtfs/{id}/rebalance/prepare": managerPrepare(
      "Trade a slot toward its target (`executeRebalance`)",
      "Sells an overweight (or 0%) slot to USDG, or buys an underweight one with free USDG. 409 when within 50 bps of target, prices are stale, or the basket isn't active.",
      ["slotIndex"],
      { slotIndex: s("integer"), slippageBps: slippage },
    ),
    "/api/v1/manager/dtfs/{id}/allocations/prepare": managerPrepare(
      "Set target weights (`setTargetAllocations`)",
      "The full list, not a diff: up to 20 unique active assets summing to 10000 bps. Assets left out go to 0% and are sold off by rebalance. No swaps happen in this call.",
      ["weights"],
      { weights: s("array", { items: s("object", { required: ["assetId", "weightBps"], properties: { assetId: { ...ref("Address"), description: "Asset token" }, weightBps: s("integer") } }) }) },
    ),
    "/api/v1/manager/dtfs/{id}/pause/prepare": managerPrepare("Pause or unpause (`setPaused`)", "Pausing stops buys, genesis, deploy and rebalance. Sales still work.", ["paused"], { paused: s("boolean") }),
    "/api/v1/manager/dtfs/{id}/write-off/prepare": managerPrepare(
      "Propose writing off an asset (`proposeWriteOff`)",
      "Takes effect when a protocol super-admin confirms it.",
      ["assetId"],
      { assetId: { ...ref("Address"), description: "Asset token in this basket" } },
    ),
    "/api/v1/manager/dtfs/{id}/reactivate/prepare": managerPrepare(
      "Propose reactivating a written-off asset (`proposeReactivate`)",
      "Takes effect when a protocol super-admin confirms it; the asset returns at 0%. 409 when the asset isn't written off.",
      ["assetId"],
      { assetId: { ...ref("Address"), description: "Asset token" } },
    ),
    "/api/v1/manager/dtfs/{id}/fee-recipient/prepare": managerPrepare(
      "Change where manager fees go (`setFeeRecipient`)",
      "Applies to fees from the next buy or sale.",
      ["feeRecipient"],
      { feeRecipient: ref("Address") },
    ),
  },
} as const;

/** Swagger UI page: assets from jsDelivr, pinned version + SRI hashes (bump both together). */
export const swaggerHtml = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>ZenoIndex API</title>
  <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui.css" integrity="sha384-wxLW6kwyHktdDGr6Pv1zgm/VGJh99lfUbzSn6HNHBENZlCN7W602k9VkGdxuFvPn" crossorigin="anonymous" />
</head>
<body>
  <div id="swagger-ui"></div>
  <script src="https://cdn.jsdelivr.net/npm/swagger-ui-dist@5.17.14/swagger-ui-bundle.js" integrity="sha384-wmyclcVGX/WhUkdkATwhaK1X1JtiNrr2EoYJ+diV3vj4v6OC5yCeSu+yW13SYJep" crossorigin="anonymous"></script>
  <script>
    window.ui = SwaggerUIBundle({ url: "/openapi.json", dom_id: "#swagger-ui", persistAuthorization: true, tryItOutEnabled: true });
  </script>
</body>
</html>`;
