// Read-only deployment and wallet preflight. Never signs or broadcasts a transaction.
// pnpm --filter @zenoindex/api check:mainnet [0xWallet]
import {
  canCreateVault, getAssets, getProtocol, getVault, listVaults, MAINNET,
  robinhood, UniswapV4AdapterAbi, ZenoIndexVaultAbi,
} from "@zenoindex/sdk";
import { createPublicClient, erc20Abi, formatEther, formatUnits, http, isAddress, type Address } from "viem";

const walletArg = process.argv[2];
if (walletArg && !isAddress(walletArg, { strict: false })) throw new Error("Expected a public EVM wallet address");
const wallet = walletArg?.toLowerCase() as Address | undefined;
const client = createPublicClient({ chain: robinhood, transport: http(process.env.RPC_URL) });
if (await client.getChainId() !== MAINNET.chainId) throw new Error("RPC is not Robinhood mainnet (4663)");

const factory = { address: MAINNET.factory, abi: ZenoIndexVaultAbi } as const;
const adapter = { address: MAINNET.adapter, abi: UniswapV4AdapterAbi } as const;
const [protocol, assets, vaults, links] = await Promise.all([
  getProtocol(client), getAssets(client), listVaults(client),
  client.multicall({ allowFailure: false, contracts: [
    { ...factory, functionName: "accessMaster" },
    { ...factory, functionName: "vaultImplementation" },
    { ...factory, functionName: "feeEscrow" },
    { ...adapter, functionName: "poolManager" },
    { ...adapter, functionName: "isAuthorizedCaller", args: [MAINNET.factory] },
  ] }),
]);
const expected = [MAINNET.accessMaster, MAINNET.vaultImplementation, MAINNET.feeEscrow, MAINNET.poolManager];
for (let i = 0; i < expected.length; i++) {
  if (String(links[i]).toLowerCase() !== expected[i]) throw new Error(`Deployment mismatch: ${expected[i]}`);
}
if (protocol.router.toLowerCase() !== MAINNET.adapter || protocol.usdg.toLowerCase() !== MAINNET.usdg || !links[4]) {
  throw new Error("Factory router, stablecoin or adapter authorization mismatch");
}
console.log("Deployment verified", MAINNET.factory, "chain", MAINNET.chainId, "emergency", protocol.isEmergency);
console.log("Vaults", vaults.length);
for (const address of vaults) {
  const v = await getVault(client, address);
  console.log(JSON.stringify({ address, name: v.name, manager: v.manager, genesisDone: v.genesisDone, navReadable: v.totalNav !== null }));
}
const now = BigInt((await client.getBlock()).timestamp);
for (const asset of assets) {
  const stable = asset.mint.toLowerCase() === MAINNET.usdg;
  const [hasPrice, updatedAt] = stable ? [true, now] : await client.multicall({ allowFailure: false, contracts: [
    { ...factory, functionName: "hasPrice", args: [asset.mint] },
    { ...factory, functionName: "priceUpdatedAt", args: [asset.mint] },
  ] });
  console.log(JSON.stringify({ assetId: String(asset.assetId), symbol: asset.symbol, address: asset.mint,
    active: asset.active, hasPrice, priceAgeSeconds: Number(now - updatedAt), stale: !hasPrice || now - updatedAt > protocol.maxPriceAge }));
}
if (wallet) {
  const [creator, eth, usdg] = await Promise.all([
    canCreateVault(client, wallet), client.getBalance({ address: wallet }),
    client.readContract({ address: MAINNET.usdg, abi: erc20Abi, functionName: "balanceOf", args: [wallet] }),
  ]);
  console.log(JSON.stringify({ wallet, canCreateVault: creator, eth: formatEther(eth), usdg: formatUnits(usdg, 6) }));
}
