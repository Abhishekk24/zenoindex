// Read-only checks against the live Robinhood mainnet contracts. No transactions, no funds.
// Run with: ZENO_LIVE=1 pnpm test
import { createPublicClient, http, toFunctionSelector } from "viem";
import { describe, expect, it } from "vitest";
import { AccessMasterAbi, FeeEscrowAbi, getAssets, getProtocol, getVault, listVaults, MAINNET, robinhood, UniswapV4AdapterAbi, VaultAbi, ZenoIndexVaultAbi } from "../src";

const client = createPublicClient({ chain: robinhood, transport: http(process.env.RPC_URL) });

describe.skipIf(!process.env.ZENO_LIVE)("mainnet (read-only)", () => {
  it("factory matches the recorded deployment", async () => {
    expect(await client.getChainId()).toBe(MAINNET.chainId);
    const p = await getProtocol(client);
    expect(p.usdg.toLowerCase()).toBe(MAINNET.usdg);
    const impl = await client.readContract({
      address: MAINNET.factory,
      abi: [{ type: "function", name: "vaultImplementation", inputs: [], outputs: [{ type: "address" }], stateMutability: "view" }],
      functionName: "vaultImplementation",
    });
    expect(impl.toLowerCase()).toBe(MAINNET.vaultImplementation);
    expect(p.router.toLowerCase()).toBe(MAINNET.adapter);
    const [access, escrow, poolManager, authorized] = await client.multicall({ allowFailure: false, contracts: [
      { address: MAINNET.factory, abi: ZenoIndexVaultAbi, functionName: "accessMaster" },
      { address: MAINNET.factory, abi: ZenoIndexVaultAbi, functionName: "feeEscrow" },
      { address: MAINNET.adapter, abi: UniswapV4AdapterAbi, functionName: "poolManager" },
      { address: MAINNET.adapter, abi: UniswapV4AdapterAbi, functionName: "isAuthorizedCaller", args: [MAINNET.factory] },
    ] });
    expect(access.toLowerCase()).toBe(MAINNET.accessMaster);
    expect(escrow.toLowerCase()).toBe(MAINNET.feeEscrow);
    expect(poolManager.toLowerCase()).toBe(MAINNET.poolManager);
    expect(authorized).toBe(true);
  });

  it("lists every vault and reads it", async () => {
    const p = await getProtocol(client);
    const vaults = await listVaults(client);
    expect(BigInt(vaults.length)).toBe(p.totalVaults);
    for (const v of vaults) {
      const s = await getVault(client, v);
      expect(s.address).toBe(v);
      expect(s.slots.length).toBeGreaterThan(0);
    }
  });

  it("lists every asset", async () => {
    const p = await getProtocol(client);
    expect(BigInt((await getAssets(client)).length)).toBe(p.totalAssets);
  });

  it("deployed bytecode has every function in our ABIs (catches ABI built from the wrong commit)", async () => {
    // Solidity's dispatcher embeds each external function's 4-byte selector in the runtime bytecode.
    for (const [address, abi] of [
      [MAINNET.factory, ZenoIndexVaultAbi],
      [MAINNET.vaultImplementation, VaultAbi],
      [MAINNET.accessMaster, AccessMasterAbi],
      [MAINNET.feeEscrow, FeeEscrowAbi],
      [MAINNET.adapter, UniswapV4AdapterAbi],
    ] as const) {
      const code = (await client.getCode({ address }))!.toLowerCase();
      const missing = abi
        .filter((i) => i.type === "function")
        .map((f) => toFunctionSelector(f).slice(2))
        .filter((sel) => !code.includes(sel));
      expect(missing, `${address} missing selectors`).toEqual([]);
    }
  });
});
