import { Router } from "express";
import type { AppConfig } from "./config.js";
import { consumePublicApiRateLimit } from "./public-rate-limit.js";
import { customerFormSettings, getAppSettings } from "./settings/settings-service.js";

async function placesRequest(config: AppConfig, path: string, body: unknown, fields: string) {
  const response = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Goog-Api-Key": config.googlePlacesKey!, "X-Goog-FieldMask": fields },
    body: JSON.stringify(body), signal: AbortSignal.timeout(10_000),
  });
  if (!response.ok) throw new Error("PLACES_PROVIDER_FAILED");
  return response.json();
}

export function createCustomerFormRouter(config: AppConfig) {
  const router = Router();
  router.use(async (req, res, next) => {
    try {
      if (!await consumePublicApiRateLimit(req.ip ?? "unknown", config.betterAuthSecret, "customer-form", 120)) {
        res.setHeader("Retry-After", "60");
        res.status(429).json({ error: { code: "RATE_LIMITED", message: "Zu viele Anfragen. Bitte warten Sie eine Minute." } });
        return;
      }
      res.setHeader("Cache-Control", "no-store");
      next();
    } catch (error) { next(error); }
  });
  router.get("/config", async (_req, res, next) => {
    try { res.json({ data: customerFormSettings(await getAppSettings(), config) }); } catch (error) { next(error); }
  });
  router.post("/places/autocomplete", async (req, res, next) => {
    try {
      if (!config.googlePlacesKey) {
        res.status(503).json({ error: { code: "PLACES_UNAVAILABLE", message: "Die Adresssuche ist noch nicht eingerichtet. Bitte geben Sie die Adresse manuell ein." } });
        return;
      }
      const { input, sessionToken } = req.body;
      if (typeof input !== "string" || input.length < 3 || input.length > 160
        || typeof sessionToken !== "string" || !/^[a-f0-9-]{36}$/.test(sessionToken)) {
        res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adresssuche." } });
        return;
      }
      const result = await placesRequest(config, "places:autocomplete", {
        input, sessionToken, includedRegionCodes: ["de", "at"], languageCode: "de",
      }, "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text") as {
        suggestions?: Array<{ placePrediction?: { placeId: string; text: { text: string } } }>;
      };
      res.json({ data: (result.suggestions ?? []).flatMap((item: { placePrediction?: { placeId: string; text: { text: string } } }) =>
        item.placePrediction ? [{ id: item.placePrediction.placeId, label: item.placePrediction.text.text }] : []) });
    } catch (error) { next(error); }
  });
  router.post("/places/address", async (req, res, next) => {
    try {
      if (!config.googlePlacesKey) {
        res.status(503).json({ error: { code: "PLACES_UNAVAILABLE", message: "Die Adresssuche ist noch nicht eingerichtet." } });
        return;
      }
      const { id, sessionToken } = req.body;
      if (typeof id !== "string" || !/^[A-Za-z0-9_-]{1,200}$/.test(id) || typeof sessionToken !== "string" || !/^[a-f0-9-]{36}$/.test(sessionToken)) {
        res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adressauswahl." } });
        return;
      }
      const response = await fetch(`https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=de&sessionToken=${encodeURIComponent(sessionToken)}`, {
        headers: { "X-Goog-Api-Key": config.googlePlacesKey, "X-Goog-FieldMask": "addressComponents" },
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error("PLACES_PROVIDER_FAILED");
      const result = await response.json() as { addressComponents?: Array<{ types: string[]; longText: string }> };
      const part = (type: string) => result.addressComponents?.find((component) => component.types.includes(type))?.longText ?? "";
      res.json({ data: { street: [part("route"), part("street_number")].filter(Boolean).join(" "), postalCode: part("postal_code"), city: part("locality") || part("postal_town") } });
    } catch (error) { next(error); }
  });
  return router;
}
