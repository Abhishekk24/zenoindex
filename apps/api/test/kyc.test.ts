import { generatePrivateKey, privateKeyToAccount } from "viem/accounts";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createApp } from "../src/app";
import type { Db } from "../src/db";
import { signPayload, toAppStatus, verifyWebhook } from "../src/didit";
import { createSession, upsertUserByWallet } from "../src/users";
import { fakeClient, seedProject, testDb } from "./helpers";

const didit = { apiKey: "test-key", workflowId: "wf-1", webhookSecret: "whsec" };
const client = fakeClient(() => null);

let db: Db;
let pk: string;
let token: string;
let wallet: string;
let userId: string;
let diditStatus: string;

beforeEach(async () => {
  db = await testDb();
  const seeded = await seedProject(db);
  pk = seeded.pk;
  wallet = privateKeyToAccount(generatePrivateKey()).address.toLowerCase();
  const user = await upsertUserByWallet(db, seeded.projectId, wallet);
  userId = user.id;
  token = await createSession(db, user);
  diditStatus = "In Progress";
  // Stand-in for verification.didit.me.
  vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
    if (url.endsWith("/session/") && init?.method === "POST") {
      const body = JSON.parse(String(init.body));
      expect(body).toMatchObject({ workflow_id: "wf-1", vendor_data: userId }); // our id only, no PII
      return Response.json({ session_id: "sess-1", url: "https://verify.didit.me/session/sess-1", status: "Not Started" });
    }
    if (url.includes("/session/sess-1/decision/")) return Response.json({ status: diditStatus });
    throw new Error(`unexpected fetch ${url}`);
  });
});
afterEach(() => vi.unstubAllGlobals());

const make = (withDidit = true) => {
  const app = createApp({ db, client, secureCookies: false, didit: withDidit ? didit : undefined });
  const call = async (path: string, init: { body?: unknown; auth?: boolean; headers?: Record<string, string>; raw?: string } = {}) => {
    const res = await app.request(path, {
      method: init.body !== undefined || init.raw ? "POST" : "GET",
      headers: { "x-api-key": pk, "content-type": "application/json", ...(init.auth !== false && { authorization: `Bearer ${token}` }), ...init.headers },
      body: init.raw ?? (init.body === undefined ? undefined : JSON.stringify(init.body)),
    });
    return { status: res.status, json: (await res.json()) as any };
  };
  return call;
};

describe("KYC", () => {
  it("never reveals another wallet's status", async () => {
    const call = make();
    await db.query("update users set kyc_status = 'Approved'");
    expect((await call(`/api/v1/compliance/kyc/0x${"1".repeat(40)}/status`)).json).toMatchObject({ status: "not_started", approved: false });
    expect((await call(`/api/v1/compliance/kyc/${wallet}/status`, { auth: false })).json.approved).toBe(false);
    expect((await call(`/api/v1/compliance/kyc/${wallet}/status`)).json).toMatchObject({ status: "approved", approved: true });
  });

  it("says it isn't set up (503) instead of 'route not found' when Didit isn't configured", async () => {
    const r = await make(false)("/api/v1/eligibility/kyc/start", { body: { wallet } });
    expect(r.status).toBe(503);
    expect(r.json.error.code).toBe("kyc_unavailable");
  });

  it("start → url; status pulled from Didit until final", async () => {
    const call = make();
    expect((await call("/api/v1/eligibility/kyc/start", { body: { wallet: `0x${"2".repeat(40)}` } })).status).toBe(403);
    const start = await call("/api/v1/eligibility/kyc/start", { body: { wallet } });
    expect(start.json).toMatchObject({ sessionId: "sess-1", url: "https://verify.didit.me/session/sess-1" });

    expect((await call(`/api/v1/compliance/kyc/${wallet}/status`)).json).toMatchObject({ status: "pending", rawStatus: "In Progress" });
    diditStatus = "Approved";
    expect((await call(`/api/v1/compliance/kyc/${wallet}/status`)).json).toMatchObject({ status: "approved", approved: true });
    diditStatus = "Declined"; // final states are not re-fetched
    expect((await call(`/api/v1/compliance/kyc/${wallet}/status`)).json.status).toBe("approved");
  });

  it("webhook: HMAC + timestamp checked, events applied once", async () => {
    const call = make();
    await call("/api/v1/eligibility/kyc/start", { body: { wallet } });
    const now = Math.floor(Date.now() / 1000);
    const event = { event_id: "ev-1", session_id: "sess-1", status: "Approved", vendor_data: userId, decision: { score: 1.0 } };
    const hook = (payload: object, sig: string, ts = now) =>
      call("/webhooks/didit", { raw: JSON.stringify(payload), auth: false, headers: { "x-signature-v2": sig, "x-timestamp": String(ts) } });

    expect((await hook(event, "00".repeat(32))).status).toBe(401);
    expect((await hook(event, signPayload(event, "whsec"), now - 3600)).status).toBe(401);
    expect((await hook(event, signPayload(event, "whsec"))).status).toBe(200);
    expect((await db.query<{ kyc_status: string }>("select kyc_status from users")).rows[0]!.kyc_status).toBe("Approved");

    // same event replayed with a different status is ignored
    const replay = { ...event, status: "Declined" };
    await db.query("update users set kyc_last_event_id = 'ev-1'");
    expect((await hook({ ...replay }, signPayload(replay, "whsec"))).status).toBe(200);
    expect((await db.query<{ kyc_status: string }>("select kyc_status from users")).rows[0]!.kyc_status).toBe("Approved");
  });
});

describe("didit helpers", () => {
  it("maps Didit statuses to the app's", () => {
    expect([toAppStatus("Approved"), toAppStatus("Declined"), toAppStatus("In Review"), toAppStatus("Expired"), toAppStatus(null)]).toEqual([
      "approved",
      "declined",
      "pending",
      "not_started",
      "not_started",
    ]);
  });

  it("signature is over sorted keys with integral floats truncated", () => {
    const a = { b: 1.0, a: { z: 2, y: [3.0, "x"] } };
    const b = { a: { y: [3, "x"], z: 2 }, b: 1 };
    expect(signPayload(a, "s")).toBe(signPayload(b, "s"));
    expect(verifyWebhook(a, signPayload(b, "s"), 1000, "s", 1000)).toBe(true);
    expect(verifyWebhook(a, signPayload(b, "other"), 1000, "s", 1000)).toBe(false);
  });
});
