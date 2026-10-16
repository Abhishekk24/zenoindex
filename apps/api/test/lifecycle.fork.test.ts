// Real deployed contracts and V4 pools, with all writes confined to a local Anvil fork.
// anvil --fork-url https://rpc.mainnet.chain.robinhood.com --chain-id 4663 --port 8546
// ZENO_FORK_RPC_URL=http://127.0.0.1:8546 pnpm --filter @zenoindex/api test
import { MAINNET, robinhood, VaultAbi, ZenoIndexVaultAbi } from "@zenoindex/sdk";
import {
  createPublicClient, createTestClient, createWalletClient, erc20Abi, formatUnits,
  http, parseEther, parseEventLogs, type Address, type Hex,
} from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { expect, it } from "vitest";
import { makeApp, seedProject, testDb } from "./helpers";

it.skipIf(!process.env.ZENO_FORK_RPC_URL)("API lifecycle: create → seed → deposit → V4 buy → rebalance → redeem → claim fees", async () => {
  const url = new URL(process.env.ZENO_FORK_RPC_URL!);
  if (!["localhost", "127.0.0.1", "[::1]"].includes(url.hostname)) throw new Error("Fork test requires a localhost RPC");
  const client = createPublicClient({ chain: robinhood, transport: http(url.href), cacheTime: 0 });
  const version = await client.request({ method: "web3_clientVersion" });
  if (!version.toLowerCase().includes("anvil")) throw new Error("Fork test refuses to write to a non-Anvil RPC");
  const test = createTestClient({ chain: robinhood, mode: "anvil", transport: http(url.href) });
  const checkpoint = await test.snapshot();
  const db = await testDb();
  const account = privateKeyToAccount(generatePrivateKey());
  const wallet = createWalletClient({ account, chain: robinhood, transport: http(url.href) });
  const impersonated: Address[] = [];
  try {
    const { pk } = await seedProject(db, "Fork lifecycle");
    const { call } = makeApp(db, client);
    const nonce = await call("/auth/siwe/nonce", { key: pk, body: { walletAddress: account.address, chainId: MAINNET.chainId } });
    expect(nonce.status).toBe(200);
    const signature = await account.signMessage({ message: nonce.json.message });
    const login = await call("/auth/siwe/verify", { key: pk, body: { message: nonce.json.message, signature } });
    expect(login.status).toBe(200);
    const token = login.json.token as string;
    const api = async (path: string, body?: unknown) => {
      const r = await call(path, { key: pk, token, body });
      expect(r.status, `${path}: ${JSON.stringify(r.json)}`).toBe(200);
      return r.json;
    };
    const mined = async (hash: Hex) => {
      const receipt = await client.waitForTransactionReceipt({ hash });
      expect(receipt.status, hash).toBe("success");
      return receipt;
    };
    await test.setBalance({ address: account.address, value: parseEther("10") });
    // Only on this fork: give the temporary manager creator rights and test USDG.
    const admin = await client.readContract({ address: MAINNET.factory, abi: ZenoIndexVaultAbi, functionName: "superAdmin" });
    for (const address of [admin, MAINNET.poolManager]) {
      await test.impersonateAccount({ address });
      impersonated.push(address);
      await test.setBalance({ address, value: parseEther("10") });
    }
    const adminWallet = createWalletClient({ account: admin, chain: robinhood, transport: http(url.href) });
    const holderWallet = createWalletClient({ account: MAINNET.poolManager, chain: robinhood, transport: http(url.href) });
    await mined(await adminWallet.writeContract({ address: MAINNET.factory, abi: ZenoIndexVaultAbi, functionName: "setVaultCreator", args: [account.address, true] }));
    await mined(await holderWallet.writeContract({ address: MAINNET.usdg, abi: erc20Abi, functionName: "transfer", args: [account.address, 20_000_000n] }));
    await api("/auth/accept-terms", { terms: true, privacy: true });
    await api("/auth/profile", { firstName: "Fork", lastName: "Test", country: "IN" });
    const options = await api("/manager/create");
    expect(options.canCreate).toBe(true);

    const send = async (draft: any) => {
      const extra = draft.data ?? {};
      if (extra.approveToken && extra.approveAmountRaw) {
        await mined(await wallet.writeContract({ address: extra.approveToken, abi: erc20Abi, functionName: "approve", args: [draft.transaction.to, BigInt(extra.approveAmountRaw)] }));
      }
      const hash = await wallet.sendTransaction({ to: draft.transaction.to, data: draft.transaction.data, value: BigInt(draft.transaction.value) });
      await api(`/operations/${draft.requestId}/submit`, { txHash: hash });
      const receipt = await mined(hash);
      expect((await api(`/operations/${draft.requestId}/confirm`, { txHash: hash })).status).toBe("confirmed");
      console.log("confirmed", draft.action, hash);
      return receipt;
    };
    const stocks: Address[] = options.assets.filter((a: any) => a.id !== MAINNET.usdg).map((a: any) => a.id);
    expect(stocks).toHaveLength(5);
    const weights = [{ assetId: MAINNET.usdg, weightBps: 5000 }, ...stocks.map(assetId => ({ assetId, weightBps: 1000 }))];
    const created = await send(await api("/manager/create/prepare", { name: "Fork Integration", symbol: "FORK", weights, entryFeeBps: 100, exitFeeBps: 50 }));
    const [event] = parseEventLogs({ abi: ZenoIndexVaultAbi, eventName: "VaultCreated", logs: created.logs });
    const vault = event!.args.clone.toLowerCase() as Address;
    const manager = `/manager/dtfs/${vault}`;
    const investor = `/dtfs/${vault}`;
    // No TTL wait: the newly created basket must immediately appear in the app.
    expect((await api(manager)).status.genesisDone).toBe(false);
    await send(await api(`${manager}/genesis/prepare`, { baselineSharePrice: "1" }));
    expect((await api(investor)).lifecycle).toBe("active");
    const sharesToken = await client.readContract({ address: vault, abi: VaultAbi, functionName: "sharesToken" });
    await mined(await wallet.writeContract({ address: MAINNET.usdg, abi: erc20Abi, functionName: "approve", args: [vault, 2_000_000n] }));
    await send(await api(`${investor}/buy/prepare`, { amount: "2", recipient: account.address }));
    const shares = await client.readContract({ address: sharesToken, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
    expect(shares).toBeGreaterThan(1_000_000n);
    const pending = (await api(manager)).totalPendingUsdc;
    expect(Number(pending)).toBeGreaterThan(0);
    for (const [i, stock] of stocks.entries()) {
      await send(await api(`${manager}/deploy/prepare`, { slotIndex: i + 1, slippageBps: 100 }));
      expect(await client.readContract({ address: stock, abi: erc20Abi, functionName: "balanceOf", args: [vault] })).toBeGreaterThan(0n);
    }
    await send(await api(`${manager}/allocations/prepare`, { weights: [{ assetId: MAINNET.usdg, weightBps: 7500 }, ...stocks.map(assetId => ({ assetId, weightBps: 500 }))] }));
    for (const [i] of stocks.entries()) {
      await send(await api(`${manager}/rebalance/prepare`, { slotIndex: i + 1, slippageBps: 100 }));
    }
    const portfolio = await api(`/wallets/${account.address.toLowerCase()}/portfolio`);
    expect(portfolio.positions.some((p: any) => p.dtfId === vault)).toBe(true);
    const balanceBefore = await client.readContract({ address: MAINNET.usdg, abi: erc20Abi, functionName: "balanceOf", args: [account.address] });
    const steps: string[] = [];
    for (let i = 0; i < stocks.length + 2; i++) {
      const draft = await api(`${investor}/redeem/prepare`, { shares: formatUnits(shares, 6), recipient: account.address });
      steps.push(draft.step);
      await send(draft);
      if (draft.finalStep) break;
    }
    expect(steps).toEqual(["request", ...stocks.map(() => "swap"), "claim"]);
    expect(await client.readContract({ address: sharesToken, abi: erc20Abi, functionName: "balanceOf", args: [account.address] })).toBe(0n);
    expect(await client.readContract({ address: MAINNET.usdg, abi: erc20Abi, functionName: "balanceOf", args: [account.address] })).toBeGreaterThan(balanceBefore);
    const fees = await api("/manager/fees");
    expect(Number(fees.claimable)).toBeGreaterThan(0);
    await send(await api("/manager/fees/claim/prepare", {}));
    expect(Number((await api("/manager/fees")).claimable)).toBe(0);
  } finally {
    await db.close();
    await test.revert({ id: checkpoint });
    for (const address of impersonated) await test.stopImpersonatingAccount({ address });
  }
}, 300_000);
