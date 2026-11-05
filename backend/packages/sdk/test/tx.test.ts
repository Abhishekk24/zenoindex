import { decodeFunctionData, erc20Abi, getAddress, type Address } from "viem";
import { describe, expect, it } from "vitest";
import {
  applySlippage,
  buildApprove,
  buildClaim,
  buildClaimManagerFees,
  buildClaimInKind,
  buildDeposit,
  buildProposeReactivate,
  buildProposeWriteOff,
  buildRequestRedeem,
  buildSwapAssetToUsdc,
  FeeEscrowAbi,
  MAINNET,
  nextRedeemStep,
  sharePrice,
  VaultAbi,
  type RedeemProgress,
} from "../src";

const vault = "0x1111111111111111111111111111111111111111" as Address;
const asset = "0x2222222222222222222222222222222222222222" as Address;
const decode = (data: `0x${string}`) => decodeFunctionData({ abi: VaultAbi, data });

describe("tx builders", () => {
  it("deposit targets the vault with gross amount and min shares", () => {
    const tx = buildDeposit(vault, 1_000_000n, 990_000n);
    expect(tx.to).toBe(vault);
    expect(tx.value).toBe(0n);
    expect(decode(tx.data)).toEqual({ functionName: "deposit", args: [1_000_000n, 990_000n] });
  });

  it("redeem steps encode the right calls", () => {
    expect(decode(buildRequestRedeem(vault, 5n).data)).toEqual({ functionName: "requestRedeem", args: [5n] });
    expect(decode(buildSwapAssetToUsdc(vault, 1, [asset, MAINNET.usdg], 7n).data)).toEqual({
      functionName: "swapAssetToUsdc",
      args: [1, [asset, getAddress(MAINNET.usdg)], 7n], // decoder returns checksummed addresses
    });
    expect(decode(buildClaim(vault).data).functionName).toBe("claim");
    expect(decode(buildClaimInKind(vault).data).functionName).toBe("claimInKind");
  });

  it("manager calls encode the right args", () => {
    expect(decode(buildProposeWriteOff(vault, 3n).data)).toEqual({ functionName: "proposeWriteOff", args: [3n] });
    expect(decode(buildProposeReactivate(vault, 3n).data)).toEqual({ functionName: "proposeReactivate", args: [3n] });
  });

  it("fee claims go to the FeeEscrow, not the vault", () => {
    const escrow = "0x3333333333333333333333333333333333333333" as Address;
    const tx = buildClaimManagerFees(escrow, MAINNET.usdg, asset);
    expect(tx.to).toBe(escrow);
    expect(decodeFunctionData({ abi: FeeEscrowAbi, data: tx.data })).toEqual({
      functionName: "claimManagerFees",
      args: [getAddress(MAINNET.usdg), asset],
    });
  });

  it("approve targets the token", () => {
    const tx = buildApprove(MAINNET.usdg, vault, 3n);
    expect(tx.to).toBe(MAINNET.usdg);
    expect(decodeFunctionData({ abi: erc20Abi, data: tx.data })).toEqual({ functionName: "approve", args: [vault, 3n] });
  });
});

describe("applySlippage", () => {
  it("rounds down", () => {
    expect(applySlippage(1_000_000n, 50)).toBe(995_000n);
    expect(applySlippage(999n, 1)).toBe(998n); // 998.9001 → 998
    expect(applySlippage(5n, 0)).toBe(5n);
    expect(applySlippage(5n, 10_000)).toBe(0n);
  });

  it("rejects bad bps", () => {
    expect(() => applySlippage(1n, -1)).toThrow(RangeError);
    expect(() => applySlippage(1n, 10_001)).toThrow(RangeError);
    expect(() => applySlippage(1n, 1.5)).toThrow(RangeError);
  });
});

describe("sharePrice", () => {
  it("is USDG raw per whole share", () => {
    expect(sharePrice(2_000_000n, 1_000_000n)).toBe(2_000_000n); // 2 USDG NAV / 1 share = 2.000000
    expect(sharePrice(null, 1n)).toBeNull();
    expect(sharePrice(1n, 0n)).toBeNull();
  });
});

describe("nextRedeemStep", () => {
  const leg = (index: number, amountIn: bigint, swapped: boolean) => ({ index, assetId: BigInt(index), amountIn, swapped });
  const progress = (legs: ReturnType<typeof leg>[]): RedeemProgress => ({ active: true, escrowUsdc: 1n, legs });

  it("requests when nothing is open", () => {
    expect(nextRedeemStep({ active: false, escrowUsdc: 0n, legs: [] })).toEqual({ kind: "request" });
  });

  it("swaps open legs in order, skipping USDG (already swapped) and zero legs", () => {
    const p = progress([leg(0, 0n, true), leg(1, 0n, false), leg(2, 10n, false), leg(3, 4n, false)]);
    expect(nextRedeemStep(p)).toEqual({ kind: "swap", leg: leg(2, 10n, false), remaining: 2 });
  });

  it("claims when every leg is settled (100% USDG vault goes straight here)", () => {
    expect(nextRedeemStep(progress([leg(0, 0n, true)]))).toEqual({ kind: "claim" });
  });

  it("inKind settles without swaps", () => {
    expect(nextRedeemStep(progress([leg(0, 10n, false)]), { inKind: true })).toEqual({ kind: "claimInKind" });
  });
});
