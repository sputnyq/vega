import { useEffect, useRef, useState } from "react";
import { apiRequest } from "../api/api-request.js";

export interface PlaceSuggestion {
  id: string;
  label: string;
}

export interface PlaceAddress {
  street: string;
  postalCode: string;
  city: string;
}

/**
 * Shared client for the staff-only Places proxy (`/api/admin/places/*`).
 * Debounces input, aborts outdated requests and rotates the session token
 * after each selection, mirroring the public customer-form behavior.
 */
export function usePlaceAutocomplete(onSelect: (address: PlaceAddress) => void) {
  const [options, setOptions] = useState<PlaceSuggestion[]>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const session = useRef(crypto.randomUUID());
  const selection = useRef<AbortController | null>(null);

  useEffect(() => {
    if (query.length < 3) {
      setOptions([]);
      return;
    }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void apiRequest<PlaceSuggestion[]>(
        "/api/admin/places/autocomplete",
        "POST",
        { input: query, sessionToken: session.current },
        { signal: controller.signal },
      )
        .then((result) => { setOptions(result); setError(""); })
        .catch((reason: unknown) => {
          if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Adressvorschläge sind nicht verfügbar.");
        });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query]);

  useEffect(() => () => selection.current?.abort(), []);

  function abortSelection() {
    selection.current?.abort();
  }

  async function select(id: string) {
    selection.current?.abort();
    const controller = new AbortController();
    selection.current = controller;
    setOptions([]);
    setQuery("");
    try {
      const address = await apiRequest<PlaceAddress>(
        "/api/admin/places/address",
        "POST",
        { id, sessionToken: session.current },
        { signal: controller.signal },
      );
      if (!controller.signal.aborted) {
        onSelect(address);
        session.current = crypto.randomUUID();
        setError("");
      }
    } catch (reason) {
      if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Die Adresse konnte nicht übernommen werden.");
    }
  }

  return { options, query, setQuery, error, select, abortSelection };
}
