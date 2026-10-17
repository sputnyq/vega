import { Fragment, useCallback, useEffect, useRef, useState } from "react";
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

export interface RouteConfig {
  origin: string | null;
  available: boolean;
}

interface RouteDistanceProps {
  value: OrderFormValue;
  onDistance: (distance: number) => void;
  /** Bumped by the address tab whenever a route-relevant field loses focus. */
  blurToken?: number;
  /** False while the order is still loading; suppresses automatic calculation. */
  ready?: boolean;
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
  return {
    street: address.slice(0, separator),
    city: address.slice(separator + 2),
  };
}

function Place({ address }: { address: string }) {
  const { street, city } = splitAddress(address);
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: "center" }}>
      <Stack spacing={0}>
        <Typography variant="caption" sx={{ fontWeight: "bold" }}>
          {street}
        </Typography>
        {city && <Typography variant="caption">{city}</Typography>}
      </Stack>
    </Stack>
  );
}

function Connector({ leg }: { leg: RouteLeg }) {
  return (
    <Stack sx={{ justifyContent: "center", alignItems: "center" }}>
      <Typography color="primary" variant="caption">
        {leg.distanceKm} km
      </Typography>
      <ArrowRightAltOutlined color="primary" fontSize="large" />
      <Typography color="primary" variant="caption">
        {formatDurationMinutes(leg.durationMinutes)}
      </Typography>
    </Stack>
  );
}

export function RouteDistance({
  value,
  onDistance,
  blurToken = 0,
  ready = true,
}: RouteDistanceProps) {
  const [config, setConfig] = useState<RouteConfig | null>(null);
  const [result, setResult] = useState<RouteResult | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const calculation = useRef<AbortController | null>(null);
  // Route key of the last requested calculation, used to skip unchanged blurs.
  const requestedKey = useRef<string | null>(null);
  // The initial calculation runs at most once, after the configuration is known.
  const initialised = useRef(false);
  const addresses = [
    value.from,
    ...(value.details.showSecondaryFrom && value.details.secondaryFrom
      ? [value.details.secondaryFrom]
      : []),
    value.to,
    ...(value.details.showSecondaryTo && value.details.secondaryTo
      ? [value.details.secondaryTo]
      : []),
  ];
  const complete = addresses.every(
    (address) =>
      address.street.trim() && address.postalCode.trim() && address.city.trim(),
  );
  const texts = addresses.map(
    (address) => `${address.street}, ${address.postalCode} ${address.city}`,
  );
  const routeKey = texts.join("\n");
  // A stored manual or calculated distance must not be overwritten by the initial calculation.
  const hasStoredDistance =
    value.details.distanceSource === "manual" ||
    value.details.distanceSource === "route" ||
    value.details.distanceKm > 0;
  // Effects only observe blur tokens and config; the latest draft is read from this ref.
  const latest = useRef({
    texts,
    complete,
    routeKey,
    config,
    hasStoredDistance,
    onDistance,
    ready,
  });
  latest.current = {
    texts,
    complete,
    routeKey,
    config,
    hasStoredDistance,
    onDistance,
    ready,
  };

  const calculate = useCallback(async () => {
    const current = latest.current;
    if (
      !current.ready ||
      !current.config?.origin ||
      !current.config.available ||
      !current.complete
    )
      return;
    requestedKey.current = current.routeKey;
    calculation.current?.abort();
    const controller = new AbortController();
    calculation.current = controller;
    setBusy(true);
    setError("");
    try {
      const response = await apiRequest<RouteResult>(
        "/api/admin/routes/distance",
        "POST",
        { addresses: current.texts },
        { signal: controller.signal },
      );
      if (controller.signal.aborted || calculation.current !== controller)
        return;
      setResult(response);
      current.onDistance(response.distanceKm);
    } catch (reason) {
      if (controller.signal.aborted || calculation.current !== controller)
        return;
      setError(
        reason instanceof Error
          ? reason.message
          : "Die Fahrstrecke konnte nicht berechnet werden.",
      );
    } finally {
      if (calculation.current === controller && !controller.signal.aborted)
        setBusy(false);
    }
  }, []);

  useEffect(() => {
    let active = true;
    void apiRequest<RouteConfig>("/api/admin/routes/config")
      .then((next) => {
        if (active) setConfig(next);
      })
      .catch((reason: unknown) => {
        if (active)
          setError(
            reason instanceof Error
              ? reason.message
              : "Routenkonfiguration konnte nicht geladen werden.",
          );
      });
    return () => {
      active = false;
    };
  }, []);
  useEffect(() => () => calculation.current?.abort(), []);
  // A previously calculated route no longer matches edited addresses; cancel any running calculation
  // and forget the requested key so returning to a previous route recalculates on the next blur.
  useEffect(() => {
    calculation.current?.abort();
    calculation.current = null;
    requestedKey.current = null;
    setResult(null);
    setBusy(false);
  }, [routeKey]);
  // Automatic first calculation: only once the draft is ready, with a usable configuration,
  // complete addresses and no stored distance.
  useEffect(() => {
    if (!config || !ready || initialised.current) return;
    initialised.current = true;
    const current = latest.current;
    if (
      !config.available ||
      !config.origin ||
      !current.complete ||
      current.hasStoredDistance
    )
      return;
    void calculate();
  }, [config, ready, calculate]);
  // Recalculate after a route-relevant field lost focus, but only for a changed, complete address.
  useEffect(() => {
    if (blurToken === 0) return;
    const current = latest.current;
    if (
      !current.ready ||
      !current.config?.origin ||
      !current.config.available ||
      !current.complete
    )
      return;
    if (requestedKey.current === current.routeKey) return;
    void calculate();
  }, [blurToken, calculate]);
  const stops = config?.origin ? [config.origin, ...texts, config.origin] : [];
  return (
    <Stack spacing={1.5} aria-busy={busy}>
      {error && <Alert severity="error">{error}</Alert>}
      {config && (!config.origin || !config.available) && (
        <Alert severity="info">
          Für die Kartenberechnung müssen der Standort unter Optionen und der
          Google-Maps-Zugang in der Server-Runtime eingerichtet sein. Die
          manuelle Entfernungseingabe bleibt verfügbar.
        </Alert>
      )}
      {result && stops.length === result.legs.length + 1 && (
        <Stack
          spacing={1}
          direction="row"
          sx={{ alignItems: "center", flexWrap: "wrap", rowGap: 1 }}
        >
          {stops.map((address, index) => (
            <Fragment key={`${address}-${index}`}>
              <Place address={address} />
              {index < result.legs.length && (
                <Connector leg={result.legs[index]!} />
              )}
            </Fragment>
          ))}
          <Stack
            direction="row"
            spacing={1}
            sx={{ paddingLeft: 4, alignItems: "center" }}
          >
            <Typography variant="h6" color="primary">
              Gesamt: {result.distanceKm} km ·{" "}
              {formatDurationMinutes(result.durationMinutes)}
            </Typography>
          </Stack>
        </Stack>
      )}
      {!result && stops.length > 0 && (
        <Typography variant="body2" color="text.secondary">
          {stops.join(" → ")}
        </Typography>
      )}
      <Button
        variant="text"
        disabled={
          !ready || !complete || !config?.origin || !config.available || busy
        }
        onClick={() => void calculate()}
        sx={{ alignSelf: "flex-start" }}
      >
        {busy ? "Fahrstrecke wird berechnet …" : "Fahrstrecke berechnen"}
      </Button>
    </Stack>
  );
}
