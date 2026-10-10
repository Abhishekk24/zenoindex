# @zenoindex/sdk

Typed viem helpers for the ZenoIndex DTF contracts on **Robinhood Chain mainnet (4663)**.
Same pattern as the `evm-launhpad-contract/frontend/sdk/*` packages: generated ABIs + mainnet constants + read helpers + calldata builders.

## Contents

| File | What |
|---|---|
| `src/abis.ts` | **Generated** — `ZenoIndexVaultAbi`, `VaultAbi`, `ShareTokenAbi`, `AccessMasterAbi`, `UniswapV4AdapterAbi`. Do not edit. |
| `src/constants.ts` | `robinhood` viem chain (with Multicall3), `MAINNET` addresses + deploy block, `EVM_COMMIT` |
| `src/reads.ts` | `getProtocol`, `listVaults`, `getVault`, `getAssets`, `previewDeposit`, `swapFloor`, `getRedeemProgress`, `nextRedeemStep`, `sharePrice` |
| `src/tx.ts` | `buildApprove`, `buildDeposit`, `buildRequestRedeem`, `buildSwapAssetToUsdc`, `buildClaim`, `buildClaimInKind`, `applySlippage` |

## Usage

```ts
import { createPublicClient, http } from "viem";
import { robinhood, listVaults, getVault, previewDeposit, buildApprove, buildDeposit, applySlippage, MAINNET } from "@zenoindex/sdk";

const client = createPublicClient({ chain: robinhood, transport: http() });
const [vault] = await listVaults(client);
const v = await getVault(client, vault);           // name, fees, slots, totalNav, sharePrice …

const amount = 1_000_000n;                          // 1 USDG (6 decimals)
const { sharesOut } = await previewDeposit(client, vault, amount);
const txs = [buildApprove(MAINNET.usdg, vault, amount), buildDeposit(vault, amount, applySlippage(sharesOut, 50))];
// the user's wallet signs and sends each tx
```

Selling: call `getRedeemProgress` → `nextRedeemStep` → build that step → user signs → repeat until the claim is done.
`request` → `swap` (one per non-USDG asset) → `claim`. A 100% USDG vault goes `request` → `claim`. Pass `{ inKind: true }` to settle with `claimInKind` (basket tokens) instead of swapping.

## Regenerating ABIs

```bash
pnpm gen-abis                         # expects ../../../zenoindex-evm (sibling of this repo)
pnpm gen-abis -- --evm /path/to/zenoindex-evm
```
Builds `zenoindex-evm` at `EVM_COMMIT` from `git archive` in a temp dir (the evm working tree is untouched). Needs Foundry (`forge` on PATH, `~/.foundry/bin`, or `FORGE=`). When mainnet is redeployed, bump `EVM_COMMIT` in both `scripts/gen-abis.mjs` and `src/constants.ts` and update `MAINNET`.

## Tests

```bash
pnpm test                 # unit: calldata round-trips, slippage, redeem step machine
ZENO_LIVE=1 pnpm test     # + read-only mainnet checks: addresses, vault/asset reads, every ABI selector exists in deployed bytecode
```
