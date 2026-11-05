import { buildDeposit } from "@zenoindex/sdk";
import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { beforeEach, describe, expect, it } from "vitest";
import type { Db } from "../src/db";
import { createSession, upsertUserByWallet } from "../src/users";
import { fakeClient, makeApp, seedProject, testDb, type RpcHandler } from "./helpers";

const vault = "0x1111111111111111111111111111111111111111";
const hash = `0x${"ab".repeat(32)}`;
const tx = buildDeposit(vault, 1_000_000n, 990_000n);

// What the chain says about `hash`; tests mutate it.
let chainTx: { from: string; to: string; input: string } | null;
let receiptStatus: "0x1" | "0x0" | null;

const rpc: RpcHandler = (method, params) => {
  if (method === "eth_getTransactionByHash") {
    if (!chainTx) return null;
    return {
      hash: params[0], ...chainTx, value: "0x0", nonce: "0x1", gas: "0x5208", maxFeePerGas: "0x1", maxPriorityFeePerGas: "0x1",
      type: "0x2", chainId: "0x1237", blockHash: `0x${"cd".repeat(32)}`, blockNumber: "0x1", transactionIndex: "0x0",
      v: "0x0", r: "0x1", s: "0x1", yParity: "0x0", accessList: [],
    };
  }
  if (method === "eth_getTransactionReceipt") {
    if (!receiptStatus || !chainTx) return null;
    return {
      transactionHash: params[0], blockHash: `0x${"cd".repeat(32)}`, blockNumber: "0x1", from: chainTx.from, to: chainTx.to,
      status: receiptStatus, cumulativeGasUsed: "0x1", gasUsed: "0x1", effectiveGasPrice: "0x1", logs: [],
      logsBloom: `0x${"0".repeat(512)}`, contractAddress: null, transactionIndex: "0x0", type: "0x2",
    };
  }
  throw new Error(`unexpected RPC call: ${method}`);
};

let db: Db;
let call: ReturnType<typeof makeApp>["call"];
let pk: string;
let token: string;
let wallet: string;
let opId: string;

beforeEach(async () => {
  db = await testDb();
  const seeded = await seedProject(db);
  pk = seeded.pk;
  ({ call } = makeApp(db, fakeClient(rpc)));
  wallet = privateKeyToAccount(generatePrivateKey()).address.toLowerCase();
  const user = await upsertUserByWallet(db, seeded.projectId, wallet);
  token = await createSession(db, user);
  const { rows } = await db.query<{ id: string }>(
    `insert into operations (project_id, user_id, wallet_address, action, vault_address, chain_id, tx_to, tx_data, amount_raw)
     values ($1, $2, $3, 'buy', $4, 4663, $4, $5, 1000000) returning id`,
    [seeded.projectId, user.id, wallet, vault, tx.data.toLowerCase()],
  );
  opId = rows[0]!.id;
  chainTx = { from: wallet, to: vault, input: tx.data };
  receiptStatus = "0x1";
});

const op = (path = "", body?: unknown) => call(`/operations/${opId}${path}`, { key: pk, token, body });

describe("operations", () => {
  it("submit → confirm verifies the mined tx and is idempotent", async () => {
    expect((await op("/submit", { txHash: hash })).json.status).toBe("submitted");
    expect((await op("/submit", { txHash: hash })).json.status).toBe("submitted"); // retried submit
    const confirmed = await op("/confirm", { txHash: hash });
    expect(confirmed.json).toMatchObject({ id: opId, status: "confirmed", txHash: hash });
    expect((await op("/confirm", { txHash: hash })).json.status).toBe("confirmed");
    expect((await op()).json.status).toBe("confirmed");
  });

  it("confirm works straight from draft (app died before submit)", async () => {
    expect((await op("/confirm", { txHash: hash })).json.status).toBe("confirmed");
  });

  it("a reverted receipt marks the order failed even if the client says confirm", async () => {
    receiptStatus = "0x0";
    expect((await op("/confirm", { txHash: hash })).json).toMatchObject({ status: "failed", failureReason: "transaction reverted" });
  });

  it("a successful receipt wins over a client 'fail'", async () => {
    expect((await op("/fail", { txHash: hash, reason: "transaction reverted" })).json.status).toBe("confirmed");
  });

  it("not mined yet → stays submitted", async () => {
    receiptStatus = null;
    expect((await op("/confirm", { txHash: hash })).json.status).toBe("submitted");
  });

  it("rejects a tx that isn't the prepared one (different calldata or sender)", async () => {
    chainTx = { from: wallet, to: vault, input: buildDeposit(vault, 5n, 0n).data };
    const r = await op("/confirm", { txHash: hash });
    expect(r.status).toBe(409);
    expect(r.json.error.code).toBe("tx_mismatch");

    chainTx = { from: "0x2222222222222222222222222222222222222222", to: vault, input: tx.data };
    expect((await op("/confirm", { txHash: hash })).status).toBe(409);
    expect((await op()).json.status).toBe("draft_prepared");
  });

  it("can't move a confirmed order back", async () => {
    await op("/confirm", { txHash: hash });
    expect((await op("/submit", { txHash: `0x${"ef".repeat(32)}` })).status).toBe(409);
    expect((await op("/fail", {})).json.status).toBe("confirmed");
  });

  it("fail without a tx hash cancels a draft", async () => {
    expect((await op("/fail", { reason: "user rejected" })).json).toMatchObject({ status: "failed", failureReason: "user rejected" });
  });

  it("other users can't see or touch the order", async () => {
    const { rows } = await db.query<{ project_id: string }>("select project_id from operations limit 1");
    const stranger = await upsertUserByWallet(db, rows[0]!.project_id, privateKeyToAccount(generatePrivateKey()).address);
    const strangerToken = await createSession(db, stranger);
    const r = await call(`/operations/${opId}/confirm`, { key: pk, token: strangerToken, body: { txHash: hash } });
    expect(r.status).toBe(404);
    expect((await call(`/operations/${opId}`, { key: pk })).status).toBe(401);
  });
});
