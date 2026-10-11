import type { Hono } from "hono";
import { z } from "zod";
import { address, parseBody, requireUser, type AppEnv, type Deps } from "../context";
import type { Db } from "../db";
import { createSession, fetchStatus, isFinal, toAppStatus, verifyWebhook } from "../didit";
import { ApiError } from "../errors";

type KycRow = { id: string; wallet_address: string; kyc_status: string | null; kyc_session_id: string | null };

const view = (wallet: string, row?: Pick<KycRow, "kyc_status" | "kyc_session_id">) => ({
  wallet,
  provider: "didit",
  status: toAppStatus(row?.kyc_status),
  approved: row?.kyc_status === "Approved",
  sessionId: row?.kyc_session_id ?? null,
  rawStatus: row?.kyc_status ?? null,
});

async function setStatus(db: Db, userId: string, status: string, eventId?: string) {
  await db.query(
    `update users set kyc_status = $2, kyc_updated_at = now(), kyc_last_event_id = coalesce($3, kyc_last_event_id),
       kyc_approved_at = case when $2 = 'Approved' then coalesce(kyc_approved_at, now()) else null end
     where id = $1`,
    [userId, status, eventId ?? null],
  );
}

export function kycRoutes(app: Hono<AppEnv>, { db, didit }: Deps) {
  // The basket page loads this for any wallet; only the signed-in user's own status is ever revealed.
  app.get("/compliance/kyc/:wallet/status", async (c) => {
    const wallet = c.req.param("wallet").toLowerCase();
    const user = c.get("user");
    if (!user || user.wallet_address !== wallet) return c.json(view(wallet));

    const { rows } = await db.query<KycRow>("select id, wallet_address, kyc_status, kyc_session_id from users where id = $1", [user.id]);
    const row = rows[0]!;
    // Pull the latest decision from Didit while it's open — works without a webhook (e.g. local/ngrok).
    if (didit && row.kyc_session_id && !isFinal(row.kyc_status)) {
      const latest = await fetchStatus(didit, row.kyc_session_id).catch(() => null);
      if (latest && latest !== row.kyc_status) {
        await setStatus(db, user.id, latest);
        row.kyc_status = latest;
      }
    }
    return c.json(view(wallet, row));
  });

  app.post("/eligibility/kyc/start", async (c) => {
    const user = requireUser(c);
    const { wallet } = await parseBody(c, z.object({ wallet: address }));
    if (wallet !== user.wallet_address) throw new ApiError(403, "wallet_mismatch", "Verify with the wallet you signed in with.");
    if (!didit) throw new ApiError(503, "kyc_unavailable", "Identity verification isn't set up yet. Please try again later.", false);

    // vendor_data is our user id — no personal data leaves this service.
    const session = await createSession(didit, user.id).catch((e: Error) => {
      throw new ApiError(502, "kyc_provider_error", `Couldn't start verification: ${e.message}`);
    });
    await db.query("update users set kyc_session_id = $2, kyc_status = $3, kyc_updated_at = now() where id = $1", [
      user.id,
      session.sessionId,
      session.status,
    ]);
    return c.json(session);
  });
}

/** Didit → us. Mounted outside /api/v1: Didit has no API key; it is authenticated by HMAC instead. */
export function diditWebhook(app: Hono<AppEnv>, { db, didit }: Deps) {
  app.post("/webhooks/didit", async (c) => {
    if (!didit?.webhookSecret) throw new ApiError(503, "kyc_unavailable", "Webhook not configured.", false);
    let payload: { event_id?: string; session_id?: string; status?: string; vendor_data?: string; timestamp?: number };
    try {
      payload = JSON.parse(await c.req.text());
    } catch {
      throw new ApiError(400, "invalid_json", "Invalid JSON.");
    }
    const ok = verifyWebhook(payload, c.req.header("x-signature-v2") ?? "", didit.webhookSecret);
    if (!ok) throw new ApiError(401, "bad_signature", "Bad signature.");
    if (!payload.session_id || !payload.status || !payload.vendor_data) return c.json({ ok: true });

    // One atomic update: matches this user's session and skips an event already applied (Didit retries deliveries).
    await db.query(
      `update users set kyc_status = $3, kyc_updated_at = now(), kyc_last_event_id = $4,
         kyc_approved_at = case when $3 = 'Approved' then coalesce(kyc_approved_at, now()) else null end
       where id::text = $1 and kyc_session_id = $2 and ($4::text is null or kyc_last_event_id is distinct from $4)`,
      [payload.vendor_data, payload.session_id, payload.status, payload.event_id ?? null],
    );
    return c.json({ ok: true });
  });
}
