import { Router } from "express";
import type { AppConfig } from "./config.js";
import { consumePublicApiRateLimit } from "./public-rate-limit.js";
import { customerFormSettings, getAppSettings } from "./settings/settings-service.js";
import { clientAbortSignal } from "./maps/provider-request.js";
import {
  autocompletePlaces,
  fetchPlaceAddress,
  handlePlacesError,
  isAutocompleteInput,
  isPlaceId,
  isSessionToken,
  PUBLIC_REGION_CODES,
  requirePlacesKey,
} from "./maps/places-provider.js";

const PUBLIC_MESSAGES = {
  unavailable: "Die Adresssuche ist noch nicht eingerichtet. Bitte geben Sie die Adresse manuell ein.",
  autocomplete: {
    unreachable: "Die Adresssuche ist derzeit nicht erreichbar. Bitte geben Sie die Adresse manuell ein.",
    failed: "Die Adresssuche ist derzeit nicht verfügbar. Bitte geben Sie die Adresse manuell ein.",
  },
  address: {
    unreachable: "Die Adresse konnte nicht übernommen werden. Bitte geben Sie sie manuell ein.",
    failed: "Die Adresse konnte nicht übernommen werden. Bitte geben Sie sie manuell ein.",
  },
};

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
    const apiKey = requirePlacesKey(config, res, PUBLIC_MESSAGES.unavailable);
    if (!apiKey) return;
    const { input, sessionToken } = req.body ?? {};
    if (!isAutocompleteInput(input) || !isSessionToken(sessionToken)) {
      res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adresssuche." } });
      return;
    }
    try {
      res.json({ data: await autocompletePlaces(apiKey, input, sessionToken, PUBLIC_REGION_CODES, clientAbortSignal(res)) });
    } catch (error) { handlePlacesError(error, req, res, next, PUBLIC_MESSAGES.autocomplete); }
  });
  router.post("/places/address", async (req, res, next) => {
    const apiKey = requirePlacesKey(config, res, PUBLIC_MESSAGES.unavailable);
    if (!apiKey) return;
    const { id, sessionToken } = req.body ?? {};
    if (!isPlaceId(id) || !isSessionToken(sessionToken)) {
      res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adressauswahl." } });
      return;
    }
    try {
      res.json({ data: await fetchPlaceAddress(apiKey, id, sessionToken, clientAbortSignal(res)) });
    } catch (error) { handlePlacesError(error, req, res, next, PUBLIC_MESSAGES.address); }
  });
  return router;
}
