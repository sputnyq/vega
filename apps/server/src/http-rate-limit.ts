import rateLimit, { ipKeyGenerator } from "express-rate-limit";
import type { RequestHandler } from "express";

function staffKey(req: { ip?: string | undefined }, res: { locals?: { staffUser?: { id?: unknown } } }): string {
  const id = res.locals?.staffUser?.id;
  if (typeof id === "string" && id.length > 0) return `staff:${id}`;
  return ipKeyGenerator(req.ip ?? "unknown");
}

function jsonHandler(code: string, message: string) {
  return (_req: unknown, res: { setHeader(name: string, value: string): void; status(code: number): { json(body: unknown): void } }) => {
    res.setHeader("Retry-After", "60");
    res.status(429).json({ error: { code, message } });
  };
}

/**
 * IP-keyed limiter for loader, static builds, and SPA entry routes. These
 * handlers touch the filesystem on every request; the limit keeps repeated
 * asset fetching from becoming a local DoS vector. Quota is generous on
 * purpose: a normal SPA load needs only a handful of assets.
 */
export function createAssetRateLimit(options?: { max?: number }): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: options?.max ?? 300,
    standardHeaders: true,
    legacyHeaders: false,
    handler: jsonHandler("RATE_LIMITED", "Zu viele Anfragen. Bitte versuchen Sie es später erneut."),
  });
}

/**
 * Per-staff limiter for completed admin APIs. Mounted after
 * requireCompletedStaff so only authenticated, TOTP-completed staff consume
 * quota; anonymous requests are still rejected with 401/403 before this runs.
 * The existing persistent Prisma-backed limits (public APIs, staff password
 * confirmation) stay in place; this adds the standard middleware CodeQL and
 * reviewers can verify at the route boundary.
 */
export function createAdminRateLimit(options?: { max?: number }): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: options?.max ?? 120,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => staffKey(req, res),
    handler: jsonHandler("RATE_LIMITED", "Zu viele Anfragen. Bitte versuchen Sie es später erneut."),
  });
}

/**
 * Strict per-staff limiter for the profile e-mail change, matching the
 * five-per-minute posture of staff password confirmation (ADR 0002): the
 * password verification and user update must not be reachable in a tight loop.
 */
export function createProfileEmailRateLimit(options?: { max?: number }): RequestHandler {
  return rateLimit({
    windowMs: 60_000,
    max: options?.max ?? 5,
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req, res) => staffKey(req, res),
    handler: jsonHandler("RATE_LIMITED", "Zu viele Bestätigungen. Bitte warten Sie eine Minute."),
  });
}
