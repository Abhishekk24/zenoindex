# Uniswap developer feedback: ZenoIndex on Arc

ZenoIndex is an on-chain index-basket protocol. Basket vaults rebalance into their target weights through
Uniswap v4: a vault asks the factory to swap, and the factory routes the swap through our own v4 router
(`UniswapV4Adapter`), which calls the PoolManager directly. We brought the protocol to **Arc testnet**
(chain 5042002) at ETHGlobal Mumbai. This is what we hit along the way, written while doing it.

## Where Uniswap is used in this repo

| What | Code |
|---|---|
| v4 router: `swap` pulls the input, then `PoolManager.unlock` | [`UniswapV4Adapter.sol#L121-L137`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L121-L137) |
| Unlock callback: per-hop `swap`, `sync`/`settle` the input, `take` the output | [`UniswapV4Adapter.sol#L139-L203`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L139-L203) |
| Hook allowlist and per-pair pool registry | [`UniswapV4Adapter.sol#L93-L119`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L93-L119) |
| Factory entry point: only vault clones can swap, with a price-table floor on `minAmountOut` | [`ZenoIndexVault.sol#L381-L412`](contracts/src/arc/ZenoIndexVault.sol#L381-L412) |
| Vault swap paths (deploy USDC into assets, sell assets, rebalance) | [`Vault.sol#L404-L454`](contracts/src/arc/Vault.sol#L404-L454), [`Vault.sol#L539-L574`](contracts/src/arc/Vault.sol#L539-L574), [`Vault.sol#L744-L754`](contracts/src/arc/Vault.sol#L744-L754) |
| Tests | [`test/arc/UniswapV4Adapter.t.sol`](contracts/test/arc/UniswapV4Adapter.t.sol) (18 tests) |

The adapter predates the hackathon (Robinhood Chain). For Arc we added the delta checks described below.

## What worked well

- **The unlock / callback model.** One `unlock` per swap, every hop inside `unlockCallback`, input settled
  with `sync` + transfer + `settle` and output paid with `take`. Chaining multi-hop exact-input swaps in a
  single callback was easy to reason about and to test.
- **`BalanceDelta`** made the per-hop accounting explicit, which is what let us add the safety checks below.
- **Foundry + v4-core as a library** worked without wrappers once the compiler was pinned.

## Friction

### 1. Three PoolManagers on Arc testnet, and nothing saying which one is canonical
Arc testnet has three contracts verified on the explorer as `PoolManager`:

| Address | Notes |
|---|---|
| `0x8366a39CC670B4001A1121B8F6A443A643e40951` | Same address as Arc mainnet. The official Quoter (`0x8Dc1…8F94`), StateView (`0xF333…673b`), PositionManager (`0x6049…f82B`) and UniversalRouter (`0x4fcA…9Fb1`) are deployed on testnet and all point here. |
| `0x15b5f2c054b9dc788250131fcd1bcfcc34080a59` | Third-party deployment (owner `0xceeD…dd56`); has had real swaps through a hook. |
| `0x1d70945634F618eefdF9EDaAdB59B9A183CEF929` | Third-party deployment (owner `0x5457…40c3`). |

Because the periphery addresses matched the Arc **mainnet** table, we first concluded they were
mainnet-only and treated `0x15b5…` as "the" testnet PoolManager; our adapter then got deployed against a
third one, `0x1d70…`, which has no Quoter or PositionManager. Without a published Arc testnet deployment
table there was no way to tell the canonical manager from community deployments except reading
`poolManager()` off each periphery contract, which we only did late.

**Request:** list Arc testnet (and every testnet) in the v4 deployments docs, and mark the canonical
PoolManager on the explorer or in docs, so integrators don't build on an orphaned manager.

### 2. No pools or liquidity for new test tokens
Our demo basket holds test tokens (NVDA, TSLA, META, MU, SPCX). None have v4 pools on Arc testnet, so
rebalancing swaps cannot execute yet and baskets stay in USDC. Bootstrapping means initialising each pool and
adding liquidity through PositionManager per pair.

**Request:** a short "seed a test pool" script or guide (initialise + mint a full-range position with
Foundry) for testnets would make this a five-minute step.

### 3. Hooks that return deltas, from a router's point of view
For exact-input swaps, a pool's hook can change the deltas the router must settle. We added two checks in
the callback: revert if the input delta is positive or the output delta negative
([`L169-L171`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L169-L171)), and revert if a hook asks the
router to settle more input than it received
([`L176-L179`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L176-L179)). We also gate hooks with an
allowlist.

**Request:** a "writing your own router" page covering which delta signs and magnitudes a router must
reject, partial fills on multi-hop paths (we only allow a refund on the first hop), and what an integrator
should assume about arbitrary hooks.

### 4. Signed amounts
`amountSpecified` is `int256`, so routers convert `uint256` amounts themselves. We added an explicit bound
([`L144`](contracts/src/arc/adapters/UniswapV4Adapter.sol#L144)) before `-int256(amount)`.

**Request:** a safe conversion helper in v4-periphery for custom routers.

### 5. Compiler pinning
v4-core needs solc 0.8.26 with `evm_version = "cancun"` (transient storage), so the whole Foundry project
had to be pinned to that compiler ([`contracts/foundry.toml`](contracts/foundry.toml)). Clear once known,
but the first build failures were not obvious.

## Next steps for us

Point the adapter at the canonical PoolManager (`0x8366…0951`), seed USDC pools for the basket tokens
through the canonical PositionManager, and quote rebalances with the canonical Quoter instead of only our
price-table floor.
