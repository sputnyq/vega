import { useEffect, useRef, useState } from "react";
import { Alert, Button, Stack, Typography } from "@mui/material";
import { catalogRequest } from "../catalog/catalog-api.js";
import type { OrderFormValue } from "./order-form-types.js";

export function RouteDistance({ value, onDistance }: { value: OrderFormValue; onDistance: (distance: number) => void }) {
  const [config, setConfig] = useState<{ origin: string | null; available: boolean } | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const controller = useRef<AbortController | null>(null);
  const addresses = [value.from, ...(value.details.showSecondaryFrom && value.details.secondaryFrom ? [value.details.secondaryFrom] : []),
    value.to, ...(value.details.showSecondaryTo && value.details.secondaryTo ? [value.details.secondaryTo] : [])];
  const complete = addresses.every((address) => address.street.trim() && address.postalCode.trim() && address.city.trim());
  const texts = addresses.map((address) => `${address.street}, ${address.postalCode} ${address.city}`);
  const routeKey = texts.join("\n");
  useEffect(() => {
    let active = true;
    void catalogRequest<{ origin: string | null; available: boolean }>("/api/admin/routes/config").then((result) => { if (active) setConfig(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Routenkonfiguration konnte nicht geladen werden."); });
    return () => { active = false; controller.current?.abort(); };
  }, []);
  useEffect(() => { controller.current?.abort(); setBusy(false); }, [routeKey]);
  async function calculate() {
    controller.current?.abort();
    const abort = new AbortController(); controller.current = abort;
    setBusy(true); setError("");
    try {
      const response = await fetch("/api/admin/routes/distance", { method: "POST", headers: { "Content-Type": "application/json" },
        credentials: "same-origin", body: JSON.stringify({ addresses: texts }), signal: abort.signal });
      const result = await response.json() as { data?: { distanceKm: number }; error?: { message?: string } };
      if (!response.ok || !result.data) throw new Error(result.error?.message ?? "Die Fahrstrecke konnte nicht berechnet werden.");
      if (!abort.signal.aborted) onDistance(result.data.distanceKm);
    } catch (reason) { if (!abort.signal.aborted) setError(reason instanceof Error ? reason.message : "Die Fahrstrecke konnte nicht berechnet werden."); }
    finally { if (!abort.signal.aborted) setBusy(false); }
  }
  return <Stack spacing={1.5}>
    {error && <Alert severity="error">{error}</Alert>}
    {config && (!config.origin || !config.available) && <Alert severity="info">Für die Kartenberechnung müssen der Standort unter Optionen und der Google-Routes-Zugang in der Server-Runtime eingerichtet sein. Die manuelle Entfernungseingabe bleibt verfügbar.</Alert>}
    {config?.origin && <Typography variant="body2" color="text.secondary">{[config.origin, ...texts, config.origin].join(" → ")}</Typography>}
    <Button variant="outlined" disabled={!complete || !config?.origin || !config.available || busy} onClick={() => void calculate()} sx={{ alignSelf: "flex-start" }}>
      {busy ? "Fahrstrecke wird berechnet …" : "Fahrstrecke berechnen"}
    </Button>
  </Stack>;
}
