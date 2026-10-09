import { Router } from "express";
import type { AppConfig } from "../config.js";
import { getAppSettings } from "../settings/settings-service.js";
import { consumePublicApiRateLimit } from "../public-rate-limit.js";

export function routeAddresses(body: unknown): string[] | null {
  if (typeof body !== "object" || body === null || !("addresses" in body) || !Array.isArray(body.addresses)
    || body.addresses.length < 2 || body.addresses.length > 4
    || body.addresses.some((address) => typeof address !== "string" || !address.trim() || address.length > 400)) return null;
  return body.addresses.map((address: string) => address.trim());
}
export function createRouteRouter(config: AppConfig) {
  const router = Router();
  router.get("/config", async (_req, res, next) => {
    try {
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: { origin: (await getAppSettings()).origin, available: Boolean(config.googleRoutesKey) } });
    } catch (error) { next(error); }
  });
  router.post("/distance", async (req, res, next) => {
    try {
      const settings = await getAppSettings();
      if (!settings.origin || !config.googleRoutesKey) {
        res.status(503).json({ error: { code: "ROUTES_UNAVAILABLE", message: "Für die Routenberechnung müssen Standort und Google-Routes-Zugang eingerichtet sein." } });
        return;
      }
      const addresses = routeAddresses(req.body);
      if (!addresses) return res.status(400).json({ error: { code: "INVALID_ROUTE", message: "Bitte geben Sie zwei bis vier vollständige Be-/Entladeadressen ein." } });
      if (!await consumePublicApiRateLimit(String(res.locals.staffUser.id), config.betterAuthSecret, "admin-route", 30)) {
        res.setHeader("Retry-After", "60");
        return res.status(429).json({ error: { code: "RATE_LIMITED", message: "Zu viele Routenberechnungen. Bitte warten Sie eine Minute." } });
      }
      const response = await fetch("https://routes.googleapis.com/directions/v2:computeRoutes", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Goog-Api-Key": config.googleRoutesKey, "X-Goog-FieldMask": "routes.distanceMeters" },
        body: JSON.stringify({
          origin: { address: settings.origin }, destination: { address: settings.origin },
          intermediates: addresses.map((address) => ({ address })), travelMode: "DRIVE", languageCode: "de-DE",
        }), signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) {
        req.log.warn({ code: "ROUTES_PROVIDER_FAILED", status: response.status }, "route calculation failed");
        return res.status(502).json({ error: { code: "ROUTES_PROVIDER_FAILED", message: "Google konnte die Fahrstrecke nicht berechnen." } });
      }
      const result = await response.json() as { routes?: Array<{ distanceMeters?: number }> };
      const distance = result.routes?.[0]?.distanceMeters;
      if (typeof distance !== "number" || !Number.isFinite(distance) || distance < 0 || distance > 10_000_000) {
        return res.status(502).json({ error: { code: "INVALID_ROUTE_RESPONSE", message: "Google hat keine verwendbare Fahrstrecke geliefert." } });
      }
      res.setHeader("Cache-Control", "no-store");
      return res.json({ data: { distanceKm: Math.round(distance / 1000) } });
    } catch (error) {
      if (error instanceof Error && (error.name === "TimeoutError" || error.name === "TypeError")) {
        req.log.warn({ code: "ROUTES_NETWORK_FAILED" }, "route provider unavailable");
        res.status(502).json({ error: { code: "ROUTES_NETWORK_FAILED", message: "Der Kartendienst ist derzeit nicht erreichbar." } });
      } else next(error);
      return;
    }
  });
  return router;
}
