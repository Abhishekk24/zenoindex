// Didit KYC (https://docs.didit.me), modelled on cyrene-web: v3 sessions + HMAC-signed webhooks.
import { createHmac, timingSafeEqual } from "node:crypto";

const API = "https://verification.didit.me/v3";

export type DiditConfig = { apiKey: string; workflowId: string; webhookSecret?: string; callbackUrl?: string };

export async function createSession(cfg: DiditConfig, vendorData: string) {
  const res = await fetch(`${API}/session/`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-api-key": cfg.apiKey },
    body: JSON.stringify({ workflow_id: cfg.workflowId, vendor_data: vendorData, ...(cfg.callbackUrl && { callback: cfg.callbackUrl }) }),
  });
  const data = (await res.json().catch(() => ({}))) as { session_id?: string; url?: string; status?: string; detail?: string };
  if (!res.ok || !data.session_id) throw new Error(data.detail ?? `Didit session failed (${res.status})`);
  return { sessionId: data.session_id, url: data.url, status: data.status ?? "Not Started" };
}

/** Current status straight from Didit — trusted, unlike a status the app reports. */
export async function fetchStatus(cfg: DiditConfig, sessionId: string) {
  const res = await fetch(`${API}/session/${encodeURIComponent(sessionId)}/decision/`, { headers: { "x-api-key": cfg.apiKey } });
  if (!res.ok) return null;
  const data = (await res.json().catch(() => ({}))) as { status?: string };
  return data.status ?? null;
}

/** Didit statuses → the vocabulary the mobile app maps (approved / declined / pending / not_started). */
export function toAppStatus(diditStatus: string | null | undefined) {
  switch (diditStatus) {
    case "Approved":
      return "approved";
    case "Declined":
      return "declined";
    case "In Progress":
    case "Awaiting User":
    case "In Review":
    case "Resubmitted":
      return "pending";
    default:
      return "not_started"; // Not Started, Abandoned, Expired, Kyc Expired, none
  }
}

const FINAL = new Set(["Approved", "Declined"]);
export const isFinal = (s: string | null | undefined) => Boolean(s && FINAL.has(s));

// Didit signs `JSON.stringify` of the payload with keys sorted and integral floats truncated (X-Signature-V2).
function canonical(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonical);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, canonical((value as Record<string, unknown>)[k])]),
    );
  }
  return typeof value === "number" && value % 1 === 0 ? Math.trunc(value) : value;
}

export function signPayload(payload: unknown, secret: string) {
  return createHmac("sha256", secret).update(JSON.stringify(canonical(payload)), "utf8").digest("hex");
}

/**
 * HMAC over the canonical body, then a 5-minute window on the body's SIGNED `timestamp`.
 * Never the `X-Timestamp` header: it isn't covered by the HMAC, so a replay could freshen it.
 */
export function verifyWebhook(payload: { timestamp?: unknown }, signature: string, secret: string, nowSec = Date.now() / 1000) {
  const timestamp = Number(payload.timestamp);
  if (!timestamp || Math.abs(nowSec - timestamp) > 300) return false;
  const a = Buffer.from(signature, "hex");
  const b = Buffer.from(signPayload(payload, secret), "hex");
  return a.length === b.length && timingSafeEqual(a, b);
}
