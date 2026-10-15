import { AccessMasterAbi, applySlippage, FeeEscrowAbi, MAINNET, robinhood, VaultAbi, ZenoIndexVaultAbi } from "@zenoindex/sdk";
import { decodeFunctionData, encodeFunctionResult, erc20Abi, getAbiItem, getAddress, multicall3Abi, type Abi, type Hex } from "viem";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { createSession, upsertUserByWallet } from "../src/users";
import { fakeClient, makeApp, seedProject, testDb, type RpcHandler } from "./helpers";

const vault = "0x1111111111111111111111111111111111111111";
const share = "0x2222222222222222222222222222222222222222";
const tsla = "0x3333333333333333333333333333333333333333";
const usdg = MAINNET.usdg;
const escrow = "0x4444444444444444444444444444444444444444";
const abi = [...VaultAbi, ...ZenoIndexVaultAbi, ...FeeEscrowAbi, ...AccessMasterAbi, ...erc20Abi] as Abi;

// A fake chain: contract address → function name → value, or a function of the call's args.
type Contracts = Record<string, Record<string, unknown>>;
let chain: Contracts;

function contracts(manager: string): Contracts {
  return {
    [MAINNET.factory]: {
      usdcToken: usdg, router: tsla, isEmergency: false, totalVaults: 1n, totalAssets: 2n, maxPriceAge: 86400n, maxSwapSlippageBps: 300, treasury: tsla,
      vaultClones: () => vault,
      getAsset: (id: bigint) => (id === 0n ? [0n, usdg, true, true] : [1n, tsla, true, true]),
      isVaultOperator: () => false,
      valueUsdc: (token: string, amount: bigint) => (token.toLowerCase() === usdg ? amount : (amount * 2_000_000n) / 10n ** 18n), // TSLA = $2
      swapFloor: (_in: string, _out: string, amount: bigint) => amount,
    },
    // 20% USDG / 80% TSLA. Free NAV = 1 USDG + 1 TSLA ($2) = $3 → USDG 33.33%, TSLA 66.66%; 0.4 USDG waiting to buy TSLA.
    [vault]: {
      vaultId: 0n, sharesToken: share, vaultManager: manager, feeRecipient: manager, fundType: 1, depositFeeBps: 100, redeemFeeBps: 50, maxShares: 0n,
      paused: false, adminLocked: false, genesisDone: true, totalShares: 3_400_000n, numAssets: 2, totalPendingUsdc: 400_000n, totalNav: 3_400_000n,
      assetIdAt: (i: number) => BigInt(i),
      allocationBpsAt: (i: number) => [2000, 8000][i],
      usdcTargetAmountAt: (i: number) => [0n, 400_000n][i],
      reservedAt: () => 0n,
      activeRedeemCount: 0n, vaultRedeemEscrowTotal: 0n,
      pendingWriteOff: () => false, pendingReactivate: () => false, isWrittenOff: () => false,
    },
    [share]: { name: "Tech Index", symbol: "TECH" },
    [usdg]: { name: "Global Dollar", symbol: "USDG", decimals: 6, balanceOf: () => 1_400_000n },
    [tsla]: { name: "Tesla", symbol: "TSLA", decimals: 18, balanceOf: () => 10n ** 18n },
  };
}

function ethCall(to: string, data: Hex): Hex {
  const item = getAbiItem({ abi, name: data.slice(0, 10) }) as Abi[number] & { name: string };
  const { args = [] } = decodeFunctionData({ abi: [item], data });
  const v = chain[to.toLowerCase()]?.[item.name];
  if (v === undefined) throw new Error(`unexpected call ${item.name} on ${to}`);
  const result = typeof v === "function" ? v(...args) : v;
  return encodeFunctionResult({ abi: [item], functionName: item.name, result } as never);
}

const rpc: RpcHandler = (method, params) => {
  if (method !== "eth_call") throw new Error(`unexpected RPC call: ${method}`);
  const { to, data } = params[0] as { to: string; data: Hex };
  if (to.toLowerCase() !== robinhood.contracts.multicall3.address.toLowerCase()) return ethCall(to, data);
  const { args } = decodeFunctionData({ abi: multicall3Abi, data });
  const calls = args[0] as readonly { target: string; callData: Hex }[];
  const result = calls.map((c) => ({ success: true, returnData: ethCall(c.target, c.callData) }));
  return encodeFunctionResult({ abi: multicall3Abi, functionName: "aggregate3", result });
};

let db: Db;
let call: ReturnType<typeof makeApp>["call"];
let pk: string;
let token: string;
let strangerToken: string;

beforeEach(async () => {
  db = await testDb();
  const seeded = await seedProject(db);
  pk = seeded.pk;
  ({ call } = makeApp(db, fakeClient(rpc))); // fresh client per test → fresh snapshot cache
  const wallet = privateKeyToAccount(generatePrivateKey()).address.toLowerCase();
  token = await createSession(db, await upsertUserByWallet(db, seeded.projectId, wallet));
  strangerToken = await createSession(db, await upsertUserByWallet(db, seeded.projectId, privateKeyToAccount(generatePrivateKey()).address));
  chain = contracts(wallet);
});

const prepare = (action: string, body: unknown, t = token) => call(`/manager/dtfs/${vault}/${action}/prepare`, { key: pk, token: t, body });
const decode = (data: Hex) => decodeFunctionData({ abi: VaultAbi, data });

describe("manager", () => {
  it("only the vault manager or a vault operator gets in", async () => {
    expect((await call("/manager/dtfs", { key: pk, token: strangerToken })).json.items).toEqual([]);
    const r = await call(`/manager/dtfs/${vault}`, { key: pk, token: strangerToken });
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("not_manager");
    expect((await prepare("pause", { paused: true }, strangerToken)).status).toBe(403);
    expect((await call(`/manager/dtfs/${vault}`, { key: pk })).status).toBe(401);

    chain[MAINNET.factory]!.isVaultOperator = () => true;
    ({ call } = makeApp(db, fakeClient(rpc)));
    expect((await call(`/manager/dtfs/${vault}`, { key: pk, token: strangerToken })).status).toBe(200);
  });

  it("dashboard: status, weights vs targets, and the to-do inbox", async () => {
    expect((await call("/manager/dtfs", { key: pk, token })).json.items.map((d: { id: string }) => d.id)).toEqual([vault]);
    const r = await call(`/manager/dtfs/${vault}`, { key: pk, token });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({
      id: vault,
      status: { paused: false, adminLocked: false, emergency: false, genesisDone: true },
      totalPendingUsdc: "0.4",
      redeemQueue: { activeCount: 0, escrowUsdc: "0" },
      fees: { entryBps: 100, exitBps: 50 },
      tradingFeeBps: 0, // the fake factory predates it (no accessMaster().tradingFeeBps())
      slots: [
        { index: 0, assetId: usdg, symbol: "USDG", targetBps: 2000, currentBps: 3333, driftBps: 1333, pendingDeployUsdc: "0", valueUsdc: "1", balanceRaw: "1400000" },
        { index: 1, assetId: tsla, symbol: "TSLA", targetBps: 8000, currentBps: 6666, driftBps: -1334, pendingDeployUsdc: "0.4", valueUsdc: "2", pendingWriteOff: false },
      ],
      // The weighted USDG slot isn't traded itself.
      actions: [{ kind: "deploy", slotIndex: 1, amountUsdc: "0.4" }, { kind: "rebalance", slotIndex: 1, driftBps: -1334 }],
    });
  });

  it("deploy prepare records an operation and encodes swapUsdcToAsset", async () => {
    const r = await prepare("deploy", { slotIndex: 1 });
    expect(r.status).toBe(200);
    expect(r.json).toMatchObject({ action: "manager_deploy", operation: { status: "draft_prepared", action: "manager_deploy" }, transaction: { to: vault, value: "0", chainId: 4663 } });
    expect(decode(r.json.transaction.data)).toEqual({
      functionName: "swapUsdcToAsset",
      args: [1, [getAddress(usdg), getAddress(tsla)], applySlippage(400_000n, 100)],
    });
    const { rows } = await db.query<{ action: string; amount_raw: string }>("select action, amount_raw from operations where id = $1", [r.json.requestId]);
    expect(rows[0]).toEqual({ action: "manager_deploy", amount_raw: "400000" });

    expect((await prepare("deploy", { slotIndex: 0 })).json.error.code).toBe("nothing_to_deploy");
    expect((await prepare("deploy", { slotIndex: 2 })).status).toBe(400);
  });

  it("rebalance buys the underweight slot's delta with free USDG", async () => {
    const r = await prepare("rebalance", { slotIndex: 1 });
    // delta = 1334 bps × $3 free NAV = 0.4002 USDG
    expect(decode(r.json.transaction.data)).toEqual({
      functionName: "executeRebalance",
      args: [1, [getAddress(usdg), getAddress(tsla)], applySlippage(400_200n, 100)],
    });
    expect((await prepare("rebalance", { slotIndex: 0 })).json.error.code).toBe("nothing_to_rebalance");
  });

  it("value-moving actions are refused while paused", async () => {
    chain[vault]!.paused = true;
    const r = await prepare("deploy", { slotIndex: 1 });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("not_active");
    expect(decode((await prepare("pause", { paused: false })).json.transaction.data)).toEqual({ functionName: "setPaused", args: [false] });
  });

  it("allocations: full list, sums to 10000, unique, active assets", async () => {
    const bad = async (weights: unknown) => (await prepare("allocations", { weights })).json.error;
    expect(await bad([{ assetId: usdg, weightBps: 5000 }, { assetId: tsla, weightBps: 4000 }])).toMatchObject({ code: "validation_failed", message: "weights: must sum to 10000 bps" });
    expect((await bad([{ assetId: tsla, weightBps: 5000 }, { assetId: tsla, weightBps: 5000 }])).message).toMatch(/only once/);
    expect((await bad([{ assetId: share, weightBps: 10000 }])).message).toMatch(/isn't an active asset/);

    const r = await prepare("allocations", { weights: [{ assetId: usdg, weightBps: 5000 }, { assetId: tsla, weightBps: 5000 }] });
    expect(r.json.action).toBe("manager_allocations");
    expect(decode(r.json.transaction.data)).toEqual({ functionName: "setTargetAllocations", args: [[0n, 1n], [5000, 5000]] });
  });

  it("genesis asks the app to approve the 1 USDG seed first", async () => {
    chain[vault]!.genesisDone = false;
    const r = await prepare("genesis", { baselineSharePrice: "1" });
    expect(r.json.data).toEqual({ approveToken: usdg, approveAmountRaw: "1000000" });
    expect(decode(r.json.transaction.data)).toEqual({ functionName: "genesisDeposit", args: [1_000_000_000n] });
    expect((await prepare("genesis", { baselineSharePrice: "0.000001" })).status).toBe(400);
  });
});

describe("manager fees", () => {
  const fees = (t = token) => call("/manager/fees", { key: pk, token: t });
  const claim = (body: unknown = {}, t = token) => call("/manager/fees/claim/prepare", { key: pk, token: t, body });
  const withEscrow = () => {
    chain[MAINNET.factory]!.feeEscrow = escrow;
    // 12.5 USDG accrued to the vault's manager; everyone else has nothing.
    chain[escrow] = {
      managerClaimable: (m: string, t: string) =>
        m.toLowerCase() === chain[vault]!.vaultManager && t.toLowerCase() === usdg ? 12_500_000n : 0n,
    };
  };

  it("a factory without FeeEscrow (deployed before it) has nothing to claim", async () => {
    expect((await fees()).json).toEqual({ available: false, token: usdg, claimable: "0", claimableRaw: "0", baskets: 1 });
    const r = await claim();
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("fees_unavailable");
  });

  it("shows the manager's escrowed balance across their baskets", async () => {
    withEscrow();
    expect((await fees()).json).toEqual({ available: true, token: usdg, claimable: "12.5", claimableRaw: "12500000", baskets: 1 });
    expect((await fees(strangerToken)).json).toMatchObject({ available: true, claimable: "0", baskets: 0 });
  });

  it("claim prepare targets the FeeEscrow and pays the wallet (or a recipient)", async () => {
    withEscrow();
    const r = await claim();
    expect(r.status).toBe(200);
    expect(r.json.action).toBe("manager_fee_claim");
    expect(r.json.transaction.to).toBe(escrow);
    const manager = chain[vault]!.vaultManager as string;
    expect(decodeFunctionData({ abi: FeeEscrowAbi, data: r.json.transaction.data })).toEqual({
      functionName: "claimManagerFees",
      args: [getAddress(usdg), getAddress(manager)],
    });
    const other = "0x5555555555555555555555555555555555555555";
    const toOther = await claim({ recipient: other });
    expect(decodeFunctionData({ abi: FeeEscrowAbi, data: toOther.json.transaction.data }).args[1]).toBe(getAddress(other));
  });

  it("nothing to claim is a 409, not an empty transaction", async () => {
    withEscrow();
    const r = await claim({}, strangerToken);
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("nothing_to_claim");
  });
});

describe("assets", () => {
  it("carry the token's logo when the logo source knows it, null otherwise", async () => {
    const logo = "https://cdn.robinhood.com/ncw_assets/logos/tsla.png";
    const { call: callWithLogos } = makeApp(db, fakeClient(rpc), { logos: async () => new Map([[tsla, logo]]) });
    const r = await callWithLogos("/assets", { key: pk });
    expect(r.json.items).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: tsla, symbol: "TSLA", logoUrl: logo }),
        expect.objectContaining({ id: usdg, symbol: "USDG", logoUrl: expect.stringMatching(/^data:image\/png;base64,/) }),
      ]),
    );
  });
});

describe("trading fee", () => {
  it("dashboard reports AccessMaster's rebalance trading fee", async () => {
    const accessMaster = "0x6666666666666666666666666666666666666666";
    chain[MAINNET.factory]!.accessMaster = accessMaster;
    chain[accessMaster] = { tradingFeeBps: 50 };
    expect((await call(`/manager/dtfs/${vault}`, { key: pk, token })).json.tradingFeeBps).toBe(50);
  });
});

describe("create basket", () => {
  const options = (t = token) => call("/manager/create", { key: pk, token: t });
  const create = (body: unknown, t = token) => call("/manager/create/prepare", { key: pk, token: t, body });
  const valid = {
    name: "Tech Leaders",
    symbol: "tech",
    weights: [
      { assetId: usdg, weightBps: 1000 },
      { assetId: tsla, weightBps: 9000 },
    ],
    entryFeeBps: 100,
    exitFeeBps: 50,
  };
  const allowCreator = (yes: boolean) => {
    const f = chain[MAINNET.factory]!;
    f.isVaultCreator = () => yes;
    f.superAdmin = "0x7777777777777777777777777777777777777777";
    f.hasPrice = () => true;
  };

  it("options: creator status and the assets to pick from", async () => {
    allowCreator(false);
    const r = await options();
    expect(r.status).toBe(200);
    expect(r.json.canCreate).toBe(false);
    expect(r.json.baseAssetId).toBe(usdg);
    expect(r.json.assets.map((a: { id: string; selectable: boolean }) => [a.id, a.selectable])).toEqual([
      [usdg, true],
      [tsla, true],
    ]);
    expect(r.json.limits).toEqual({ maxAssets: 20, maxEntryFeeBps: 600, minExitFeeBps: 50, maxExitFeeBps: 1000 });
  });

  it("only an allowlisted creator (or the super-admin) may create", async () => {
    allowCreator(false);
    const r = await create(valid);
    expect(r.status).toBe(403);
    expect(r.json.error.code).toBe("not_vault_creator");
  });

  it("encodes createVault on the factory; the signer becomes the manager", async () => {
    allowCreator(true);
    const r = await create(valid);
    expect(r.status).toBe(200);
    expect(r.json.action).toBe("manager_create");
    expect(r.json.transaction.to).toBe(MAINNET.factory);
    const { functionName, args } = decodeFunctionData({ abi: ZenoIndexVaultAbi, data: r.json.transaction.data });
    expect(functionName).toBe("createVault");
    expect(args[0]).toMatchObject({
      name: "Tech Leaders",
      symbol: "TECH",
      assetIds: [0n, 1n],
      allocationBps: [1000, 9000],
      depositFeeBps: 100,
      redeemFeeBps: 50,
      fundType: 1,
      maxShares: 0n,
      feeRecipient: "0x0000000000000000000000000000000000000000",
    });
  });

  it("a fixed basket needs a share cap", async () => {
    allowCreator(true);
    expect((await create({ ...valid, fundType: "fixed" })).status).toBe(400);
    const r = await create({ ...valid, fundType: "fixed", maxShares: "1000" });
    expect(r.status).toBe(200);
    expect(decodeFunctionData({ abi: ZenoIndexVaultAbi, data: r.json.transaction.data }).args[0]).toMatchObject({
      fundType: 0,
      maxShares: 1_000_000_000n,
    });
  });

  it("rejects unpriced assets and out-of-range fees", async () => {
    allowCreator(true);
    chain[MAINNET.factory]!.hasPrice = (t: string) => t.toLowerCase() !== tsla;
    const unpriced = await create(valid);
    expect(unpriced.status).toBe(400);
    expect(unpriced.json.error.code).toBe("no_price");
    chain[MAINNET.factory]!.hasPrice = () => true;
    expect((await create({ ...valid, exitFeeBps: 20 })).status).toBe(400);
    expect((await create({ ...valid, entryFeeBps: 700 })).status).toBe(400);
    expect((await create({ ...valid, weights: [{ assetId: tsla, weightBps: 9000 }] })).status).toBe(400);
  });
});
