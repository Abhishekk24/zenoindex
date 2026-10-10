import type { ContentfulStatusCode } from "hono/utils/http-status";

/** Rendered as `{ error: { status, code, message, retryable } }` — the shape the mobile app parses. `message` is shown to users. */
export class ApiError extends Error {
  constructor(
    readonly status: ContentfulStatusCode,
    readonly code: string,
    message: string,
    readonly retryable = status >= 500,
  ) {
    super(message);
  }
}

export const unauthorized = (message = "Please sign in again.") => new ApiError(401, "unauthorized", message);
export const notFound = (what: string) => new ApiError(404, "not_found", `${what} not found.`);
export const conflict = (code: string, message: string) => new ApiError(409, code, message);
export const badRequest = (code: string, message: string) => new ApiError(400, code, message);
