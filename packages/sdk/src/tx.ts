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
