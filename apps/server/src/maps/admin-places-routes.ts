import { Router } from "express";
import type { AppConfig } from "../config.js";
import { clientAbortSignal } from "./provider-request.js";
import {
  autocompletePlaces,
  fetchPlaceAddress,
  handlePlacesError,
  isAutocompleteInput,
  isPlaceId,
  isSessionToken,
  requirePlacesKey,
  STAFF_REGION_CODES,
} from "./places-provider.js";

const STAFF_MESSAGES = {
  unavailable: "Die Adresssuche ist nicht eingerichtet.",
  autocomplete: {
    unreachable: "Adressvorschläge sind derzeit nicht erreichbar.",
    failed: "Adressvorschläge sind derzeit nicht verfügbar.",
  },
  address: {
    unreachable: "Die ausgewählte Adresse konnte nicht geladen werden.",
    failed: "Die ausgewählte Adresse konnte nicht übernommen werden.",
  },
};

export function createAdminPlacesRouter(config: AppConfig) {
  const router = Router();

  router.post("/autocomplete", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const apiKey = requirePlacesKey(config, res, STAFF_MESSAGES.unavailable);
    if (!apiKey) return;
    const { input, sessionToken } = req.body ?? {};
    if (!isAutocompleteInput(input) || !isSessionToken(sessionToken)) {
      res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adresssuche." } });
      return;
    }
    try {
      res.json({ data: await autocompletePlaces(apiKey, input, sessionToken, STAFF_REGION_CODES, clientAbortSignal(res)) });
    } catch (error) { handlePlacesError(error, req, res, next, STAFF_MESSAGES.autocomplete); }
  });

  router.post("/address", async (req, res, next) => {
    res.setHeader("Cache-Control", "no-store");
    const apiKey = requirePlacesKey(config, res, STAFF_MESSAGES.unavailable);
    if (!apiKey) return;
    const { id, sessionToken } = req.body ?? {};
    if (!isPlaceId(id) || !isSessionToken(sessionToken)) {
      res.status(400).json({ error: { code: "INVALID_ADDRESS_QUERY", message: "Ungültige Adressauswahl." } });
      return;
    }
    try {
      res.json({ data: await fetchPlaceAddress(apiKey, id, sessionToken, clientAbortSignal(res)) });
    } catch (error) { handlePlacesError(error, req, res, next, STAFF_MESSAGES.address); }
  });

  return router;
}
