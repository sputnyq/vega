import type { NextFunction, Request, Response } from "express";
import type { AppConfig } from "../config.js";
import { isClientAbort, ProviderUnreachableError, providerFetch } from "./provider-request.js";

export const PUBLIC_REGION_CODES = ["de", "at"] as const;
export const STAFF_REGION_CODES = ["de", "at", "ch"] as const;

export interface PlaceSuggestion {
  id: string;
  label: string;
}

export interface PlaceAddress {
  street: string;
  postalCode: string;
  city: string;
}

export class PlacesProviderError extends Error {
  status: number;
  constructor(status: number) {
    super("PLACES_PROVIDER_FAILED");
    this.name = "PlacesProviderError";
    this.status = status;
  }
}

export interface PlacesMessages {
  unreachable: string;
  failed: string;
}

export function isSessionToken(value: unknown): value is string {
  return typeof value === "string" && /^[a-f0-9-]{36}$/.test(value);
}

export function isAutocompleteInput(value: unknown): value is string {
  return typeof value === "string" && value.length >= 3 && value.length <= 160;
}

export function isPlaceId(value: unknown): value is string {
  return typeof value === "string" && /^[A-Za-z0-9_-]{1,200}$/.test(value);
}

function isSuggestion(value: unknown): value is PlaceSuggestion {
  if (typeof value !== "object" || value === null) return false;
  const candidate = value as Record<string, unknown>;
  return typeof candidate.id === "string" && candidate.id.length > 0 && candidate.id.length <= 200
    && typeof candidate.label === "string" && candidate.label.length > 0 && candidate.label.length <= 400;
}

export function projectSuggestions(result: unknown): PlaceSuggestion[] {
  if (typeof result !== "object" || result === null || !("suggestions" in result) || !Array.isArray(result.suggestions)) return [];
  const projected: PlaceSuggestion[] = [];
  for (const item of result.suggestions) {
    if (typeof item !== "object" || item === null || !("placePrediction" in item)) continue;
    const prediction = (item as { placePrediction?: unknown }).placePrediction;
    if (typeof prediction !== "object" || prediction === null) continue;
    const record = prediction as Record<string, unknown>;
    const candidate = {
      id: record.placeId,
      label: (record.text as { text?: unknown } | undefined)?.text,
    };
    if (isSuggestion(candidate)) {
      projected.push({ id: candidate.id, label: candidate.label });
      if (projected.length >= 5) break;
    }
  }
  return projected;
}

export function projectAddressComponents(result: unknown): PlaceAddress {
  const components = typeof result === "object" && result !== null && "addressComponents" in result
    && Array.isArray((result as { addressComponents?: unknown }).addressComponents)
    ? (result as { addressComponents: Array<{ types?: unknown; longText?: unknown }> }).addressComponents
    : [];
  const part = (type: string): string => {
    const component = components.find((entry) => Array.isArray(entry.types) && entry.types.includes(type));
    return typeof component?.longText === "string" ? component.longText.slice(0, 200) : "";
  };
  const locality = part("locality") || part("postal_town");
  return {
    street: [part("route"), part("street_number")].filter(Boolean).join(" ").slice(0, 200),
    postalCode: part("postal_code").slice(0, 20),
    city: locality.slice(0, 200),
  };
}

async function readProviderJson(response: globalThis.Response): Promise<unknown> {
  if (!response.ok) throw new PlacesProviderError(response.status);
  return response.json();
}

export async function autocompletePlaces(
  apiKey: string,
  input: string,
  sessionToken: string,
  regionCodes: readonly string[],
  clientSignal: AbortSignal,
): Promise<PlaceSuggestion[]> {
  const response = await providerFetch("https://places.googleapis.com/v1/places:autocomplete", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Goog-Api-Key": apiKey,
      "X-Goog-FieldMask": "suggestions.placePrediction.placeId,suggestions.placePrediction.text.text",
    },
    body: JSON.stringify({ input, sessionToken, includedRegionCodes: [...regionCodes], languageCode: "de" }),
  }, clientSignal);
  return projectSuggestions(await readProviderJson(response));
}

export async function fetchPlaceAddress(apiKey: string, id: string, sessionToken: string, clientSignal: AbortSignal): Promise<PlaceAddress> {
  const response = await providerFetch(
    `https://places.googleapis.com/v1/places/${encodeURIComponent(id)}?languageCode=de&sessionToken=${encodeURIComponent(sessionToken)}`,
    { headers: { "X-Goog-Api-Key": apiKey, "X-Goog-FieldMask": "addressComponents" } },
    clientSignal,
  );
  return projectAddressComponents(await readProviderJson(response));
}

/** Sends the shared 503 when no key is configured and returns null; callers stop there. */
export function requirePlacesKey(config: AppConfig, res: Response, message: string): string | null {
  if (config.googleMapsKey) return config.googleMapsKey;
  res.status(503).json({ error: { code: "PLACES_UNAVAILABLE", message } });
  return null;
}

export function handlePlacesError(error: unknown, req: Request, res: Response, next: NextFunction, messages: PlacesMessages): void {
  if (isClientAbort(error)) return;
  if (error instanceof ProviderUnreachableError) {
    req.log.warn({ code: "PLACES_NETWORK_FAILED" }, "places provider unreachable");
    res.status(502).json({ error: { code: "PLACES_NETWORK_FAILED", message: messages.unreachable } });
    return;
  }
  if (error instanceof PlacesProviderError) {
    req.log.warn({ code: "PLACES_PROVIDER_FAILED", status: error.status }, "places provider request failed");
    res.status(502).json({ error: { code: "PLACES_PROVIDER_FAILED", message: messages.failed } });
    return;
  }
  next(error);
}
