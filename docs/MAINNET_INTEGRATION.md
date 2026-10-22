# October 16 mainnet integration

The deployment comes from `zenoindex-evm` source commit `e755a31`, documented by
README commit `d3d51b5`. Contract interfaces are unchanged from the SDK's previous
revision; the factory hardens price movement checks. ABIs were regenerated from
the pinned source using Foundry.

| Component | Mainnet address |
|---|---|
| Factory | `0x21369835194f59e895636f92359de3c3241997ab` |
| Vault implementation | `0xb462642086474956f572bd5d9c5352f9ffe51548` |
| AccessMaster | `0x7cd5378302af1086dba7c6e4d3610e63ef71f55c` |
| FeeEscrow | `0x11e65932196b07617180a8fc5d1885bfd1170e9f` |
| V4 adapter | `0x1e19319e3479f13747b0d059079d8396d4ccf867` |
| V4 PoolManager | `0x8366a39cc670b4001a1121b8f6a443a643e40951` |
| USDG (6 decimals) | `0x5fc5360d0400a0fd4f2af552add042d716f1d168` |

Chain ID is **4663**. Factory deployment block **90,148,628** was read from
transaction `0x75066cb735c1f3e72b57db039f613187af4b25d559f5dcc540559201470ff6e0`.

## Existing backend deployments

Migration `0009_mainnet_redeployment.sql` changes projects pointing at the old
mainnet factory `0xd00abbc1d1555a173c5081b2204579b057b05378` to the new one. Keys,
project IDs, users, sessions and operation history remain intact. Other chains
and custom factory addresses are untouched. Migrations run when the API starts,
so deploying this backend applies the switch even without seed variables.

**This does not move on-chain holdings or vaults.** Old baskets and remaining
shares stay on the old contracts; API basket and portfolio reads follow the new
factory after migration. Record and settle old positions through the old
deployment before switching a production project that needs access to them.

The new factory was verified with zero vaults at integration time. Creator
allowlists are separate from those on the previous deployment.

## Read-only verification

```powershell
pnpm --filter @zenoindex/api check:mainnet 0xYourPublicWallet
$env:ZENO_LIVE='1'; pnpm test
pnpm typecheck
```

The preflight verifies chain, factory links, adapter authorization, registered
assets, price age, wallet funds and creator permissions. It never broadcasts.
Live SDK tests compare every ABI function selector with deployed bytecode.

Prices require regular refresh by the protocol operator; the backend does not
hold an admin key or run the V4 spot-price updater.

## Local API for a physical phone

With `zenoIndex-mobile-app` beside this repository and its `.env` configured:

```bash
pnpm --filter @zenoindex/api dev:mobile http://<computer-LAN-IP>:8788
```

This loads optional Privy credentials from `apps/api/.env`, uses a separate
file-backed database at `.data/mobile`, seeds the phone's existing publishable
key, and reads the new mainnet deployment. Production databases are not used.
Set the phone app's `EXPO_PUBLIC_API_URL` to the same URL and reload Expo Go.
The phone and computer must be on a mutually reachable network.

## Fork lifecycle test

```powershell
anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663 --port 8546
# In a second terminal:
$env:ZENO_FORK_RPC_URL='http://127.0.0.1:8546'
pnpm --filter @zenoindex/api exec vitest run test/lifecycle.fork.test.ts
```

The test refuses remote/non-Anvil endpoints and restores its snapshot afterward.
Only on the fork, it funds a temporary wallet and gives it creator permission.
The actual API prepares and confirms transactions against the deployed factory,
vault implementation, fee escrow and V4 pools: SIWE, onboarding, creation,
1 USDG seed, investor approval/deposit, all five stock purchases, target updates,
rebalances, portfolio, redemption request, five sell legs, claim and manager fees.
It checks immediate visibility after creation and genesis without a cache wait.

Start a fresh fork immediately before testing when using the public RPC. It
prunes historical state; a long-running fork may fail with `historical state
... is not available` when fetching an account it has not cached. Restart the
local fork at the latest block, or use an archive RPC for a pinned older block.

## Expo Go acceptance flow

1. Use a wallet allowlisted by `setVaultCreator(wallet, true)` on the **new** factory.
   Hold USDG for the 1 USDG seed plus the test investment and ETH for gas.
2. Sign in, complete terms/profile, switch to Manager, and open Create. Verify
   USDG, NVDA, TSLA, META, MU and SPCX are offered.
3. Create a dynamic basket with valid weights and an exit fee of at least 50 bps.
   Confirm the wallet transaction; the detail screen should open immediately.
4. Tap Seed, use baseline price `1`, and approve/spend 1 USDG. Verify it becomes
   active immediately after confirmation.
5. In investor mode, invest a small USDG amount. Approve USDG to the **vault**,
   sign the deposit, and verify shares in Portfolio.
6. In Manager, deploy each pending stock allocation. Update weights and execute
   rebalances. Verify pending amounts, balances and weights refresh.
7. Redeem shares in investor mode. Sign request, each stock swap and final claim.
   Verify the final USDG balance and remaining shares.
8. In Manager → Fees, claim accrued fees and verify the claimable balance clears.

Wallet approvals and transaction prompts require the phone owner. A fork test
or Android export does not establish that Expo Go's native wallet handoff works.
The hosted API must receive this backend deployment separately; local changes
do not update `https://api.zenoindex.com`.
