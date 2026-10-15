import { Fragment, useEffect, useRef, useState } from "react";
import ArrowRightAltOutlined from "@mui/icons-material/ArrowRightAltOutlined";
import { Button, Stack, Typography } from "@mui/material";
import { AdminAlert as Alert } from "../components/AdminNotifications.js";
import { apiRequest } from "../api/api-request.js";
import type { OrderFormValue } from "./order-form-types.js";

export interface RouteLeg {
  distanceKm: number;
  durationMinutes: number;
}

export interface RouteResult {
  distanceKm: number;
  durationMinutes: number;
  legs: RouteLeg[];
}

export function formatDurationMinutes(minutes: number): string {
  if (!Number.isFinite(minutes) || minutes < 0) return "–";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} Min.`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} Std.` : `${hours} Std. ${rest} Min.`;
}

function splitAddress(address: string): { street: string; city: string } {
  const separator = address.indexOf(", ");
  if (separator < 0) return { street: address, city: "" };
  return { street: address.slice(0, separator), city: address.slice(separator + 2) };
}

function Place({ address }: { address: string }) {
  const { street, city } = splitAddress(address);
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Stack spacing={0}>
        <Typography variant="caption" sx={{ fontWeight: "bold" }}>{street}</Typography>
        {city && <Typography variant="caption">{city}</Typography>}
      </Stack>
    </Stack>
  );
}

function Connector({ leg }: { leg: RouteLeg }) {
  return (
    <Stack sx={{ justifyContent: "center", alignItems: "center" }}>
      <Typography color="primary" variant="caption">{leg.distanceKm} km</Typography>
      <ArrowRightAltOutlined color="primary" fontSize="large" />
      <Typography color="primary" variant="caption">{formatDurationMinutes(leg.durationMinutes)}</Typography>
    </Stack>
  );
}

export function RouteDistance({ value, onDistance }: { value: OrderFormValue; onDistance: (distance: number) => void }) {
  const [config, setConfig] = useState<{ origin: string | null; available: boolean } | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const calculation = useRef<AbortController | null>(null);
  const addresses = [value.from, ...(value.details.showSecondaryFrom && value.details.secondaryFrom ? [value.details.secondaryFrom] : []),
    value.to, ...(value.details.showSecondaryTo && value.details.secondaryTo ? [value.details.secondaryTo] : [])];
  const complete = addresses.every((address) => address.street.trim() && address.postalCode.trim() && address.city.trim());
  const texts = addresses.map((address) => `${address.street}, ${address.postalCode} ${address.city}`);
  const routeKey = texts.join("\n");
  useEffect(() => {
    let active = true;
    void apiRequest<{ origin: string | null; available: boolean }>("/api/admin/routes/config").then((result) => { if (active) setConfig(result); })
      .catch((reason: unknown) => { if (active) setError(reason instanceof Error ? reason.message : "Routenkonfiguration konnte nicht geladen werden."); });
    return () => { active = false; };
  }, []);
  useEffect(() => () => calculation.current?.abort(), []);
  // A previously calculated route no longer matches edited addresses; cancel any running calculation.
  useEffect(() => { calculation.current?.abort(); setResult(null); setBusy(false); }, [routeKey]);
  async function calculate() {
    calculation.current?.abort();
    const current = new AbortController();
    calculation.current = current;
    setBusy(true); setError("");
    try {
      const response = await apiRequest<RouteResult>("/api/admin/routes/distance", "POST", { addresses: texts }, { signal: current.signal });
      if (current.signal.aborted) return;
      setResult(response);
      onDistance(response.distanceKm);
    } catch (reason) {
      if (current.signal.aborted) return;
      setError(reason instanceof Error ? reason.message : "Die Fahrstrecke konnte nicht berechnet werden.");
    } finally {
      if (!current.signal.aborted) setBusy(false);
    }
  }
  const stops = config?.origin ? [config.origin, ...texts, config.origin] : [];
  return <Stack spacing={1.5}>
    {error && <Alert severity="error">{error}</Alert>}
    {config && (!config.origin || !config.available) && <Alert severity="info">Für die Kartenberechnung müssen der Standort unter Optionen und der Google-Maps-Zugang in der Server-Runtime eingerichtet sein. Die manuelle Entfernungseingabe bleibt verfügbar.</Alert>}
    {result && stops.length === result.legs.length + 1 && (
      <Stack spacing={1} direction="row" sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}>
        {stops.map((address, index) => (
          <Fragment key={`${address}-${index}`}>
            <Place address={address} />
            {index < result.legs.length && <Connector leg={result.legs[index]!} />}
          </Fragment>
        ))}
        <Stack direction="row" spacing={1} sx={{ paddingLeft: 4, alignItems: "center" }}>
          <Typography variant="h6" color="primary">
            Gesamt: {result.distanceKm} km · {formatDurationMinutes(result.durationMinutes)}
          </Typography>
        </Stack>
      </Stack>
    )}
    {!result && stops.length > 0 && (
      <Typography variant="body2" color="text.secondary">{stops.join(" → ")}</Typography>
    )}
    <Button variant="outlined" disabled={!complete || !config?.origin || !config.available || busy} onClick={() => void calculate()} sx={{ alignSelf: "flex-start" }}>
      {busy ? "Fahrstrecke wird berechnet …" : "Fahrstrecke berechnen"}
    </Button>
  </Stack>;
}
