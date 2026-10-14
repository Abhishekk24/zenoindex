import { encodeFunctionData, erc20Abi, type Address, type Hex } from "viem";
import { VaultAbi } from "./abis";
import { BPS } from "./constants";

/** Unsigned transaction for the user's wallet to sign. */
export type TxRequest = { to: Address; data: Hex; value: bigint };

const vaultTx = (vault: Address, data: Hex): TxRequest => ({ to: vault, data, value: 0n });

/** `amount * (1 - bps)`, rounded down — use for minimum-out parameters. */
export function applySlippage(amount: bigint, slippageBps: number): bigint {
  if (!Number.isInteger(slippageBps) || slippageBps < 0 || slippageBps > BPS) {
    throw new RangeError(`slippageBps must be an integer in [0, ${BPS}], got ${slippageBps}`);
  }
  return (amount * BigInt(BPS - slippageBps)) / BigInt(BPS);
}

export const buildApprove = (token: Address, spender: Address, amount: bigint): TxRequest => ({
  to: token,
  data: encodeFunctionData({ abi: erc20Abi, functionName: "approve", args: [spender, amount] }),
  value: 0n,
});

/** Needs a USDG allowance to `vault` of at least `usdgAmount` (gross; fees come out of it). */
export const buildDeposit = (vault: Address, usdgAmount: bigint, minSharesOut: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "deposit", args: [usdgAmount, minSharesOut] }));

/** Burns the shares directly — no share approval needed. One open redeem per user. */
export const buildRequestRedeem = (vault: Address, shares: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "requestRedeem", args: [shares] }));

/** `path[0]` must be the slot's asset and `path[last]` USDG; every hop must be a pool registered on the adapter. */
export const buildSwapAssetToUsdc = (vault: Address, assetIndex: number, path: readonly Address[], minUsdcOut: bigint) =>
  vaultTx(
    vault,
    encodeFunctionData({ abi: VaultAbi, functionName: "swapAssetToUsdc", args: [assetIndex, path, minUsdcOut] }),
  );

export const buildClaim = (vault: Address) => vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "claim" }));

/** Pays un-swapped legs in the underlying tokens. Works with stale prices / no swap route. */
export const buildClaimInKind = (vault: Address) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "claimInKind" }));

// Manager-only below: the sender must be `vaultManager` or a factory vault operator.
// shortcut: no FeeEscrow fee-claim builders — FeeEscrow (evm d3bd438) isn't deployed on mainnet; add them when ABIs move past 7663cc6.

/** Needs a USDG allowance to `vault` of GENESIS_SEED_USDC. `baselineSharePrice` is USDG per share × 1e9. */
export const buildGenesisDeposit = (vault: Address, baselineSharePrice: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "genesisDeposit", args: [baselineSharePrice] }));

/** Swaps the slot's whole pending USDG (`usdcTargetAmountAt`); `path` runs USDG → asset. */
export const buildSwapUsdcToAsset = (vault: Address, assetIndex: number, path: readonly Address[], minAssetOut: bigint) =>
  vaultTx(
    vault,
    encodeFunctionData({ abi: VaultAbi, functionName: "swapUsdcToAsset", args: [assetIndex, path, minAssetOut] }),
  );

/** The FULL target list (not a diff): ≤ 20 unique ids, bps summing to 10_000. Dropped assets go to 0% and wind down. */
export const buildSetTargetAllocations = (vault: Address, assetIds: readonly bigint[], allocationBps: readonly number[]) =>
  vaultTx(
    vault,
    encodeFunctionData({ abi: VaultAbi, functionName: "setTargetAllocations", args: [assetIds, allocationBps] }),
  );

/** Trades one slot toward its target. `path` is asset → USDG when selling (overweight or 0%), USDG → asset when buying. */
export const buildExecuteRebalance = (vault: Address, assetIndex: number, path: readonly Address[], minOut: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "executeRebalance", args: [assetIndex, path, minOut] }));

export const buildSetPaused = (vault: Address, paused: boolean) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "setPaused", args: [paused] }));

export const buildSetFeeRecipient = (vault: Address, feeRecipient: Address) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "setFeeRecipient", args: [feeRecipient] }));

/** Takes effect only once a super-admin confirms it on the factory. */
export const buildProposeWriteOff = (vault: Address, assetId: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "proposeWriteOff", args: [assetId] }));

/** Only for a written-off asset; a super-admin confirms it and it comes back at 0%. */
export const buildProposeReactivate = (vault: Address, assetId: bigint) =>
  vaultTx(vault, encodeFunctionData({ abi: VaultAbi, functionName: "proposeReactivate", args: [assetId] }));
