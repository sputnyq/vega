import { AddOutlined, DeleteOutlined } from "@mui/icons-material";
import { Alert, Button, FormControlLabel, Grid, MenuItem, Paper, Stack, Switch, Tab, Tabs, TextField, Typography } from "@mui/material";
import type { CatalogPackingDto, CatalogServiceDto, OrderServiceInput } from "@vega/domain";
import { useEffect, useState } from "react";
import { apiRequest } from "../api/api-request.js";
import type { OrderFormValue } from "./order-form-types.js";

interface ExtrasTabProps {
  value: OrderFormValue;
  onExtrasChange: (extras: OrderFormValue["details"]["extras"]) => void;
}

export function ExtrasTab({ value, onExtrasChange }: ExtrasTabProps) {
  const [activeKind, setActiveKind] = useState<"packaging" | "service">("packaging");
  const [catalog, setCatalog] = useState<Array<{ id: number; name: string; price: number; kind: "packaging" | "service" }>>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const extras = value.details.extras;
  const visibleServices = extras.services.filter((service) => service.kind === activeKind);

  useEffect(() => {
    let active = true;
    Promise.all([
      apiRequest<CatalogPackingDto[]>("/api/catalog/packings"),
      apiRequest<CatalogServiceDto[]>("/api/catalog/services"),
    ]).then(([packings, services]) => {
      if (active) setCatalog([
        ...packings.map((item) => ({ id: item.id, name: item.name, price: item.price, kind: "packaging" as const })),
        ...services.map((item) => ({ id: item.id, name: item.name, price: item.price, kind: "service" as const })),
      ]);
    }).catch((cause: unknown) => {
      if (active) setCatalogError(cause instanceof Error ? cause.message : "Leistungskatalog konnte nicht geladen werden.");
    });
    return () => { active = false; };
  }, []);

  function updateService(indexInVisibleList: number, patch: Partial<OrderServiceInput>) {
    let visibleIndex = -1;
    const sourceIndex = extras.services.findIndex((service) => {
      if (service.kind !== activeKind) return false;
      visibleIndex += 1;
      return visibleIndex === indexInVisibleList;
    });
    onExtrasChange({
      ...extras,
      services: extras.services.map((service, index) => index === sourceIndex ? { ...service, ...patch } : service),
    });
  }

  function addService() {
    onExtrasChange({ ...extras, services: [...extras.services, { kind: activeKind, name: "", quantity: 1 }] });
  }

  function removeService(indexInVisibleList: number) {
    const target = visibleServices[indexInVisibleList];
    onExtrasChange({ ...extras, services: extras.services.filter((service) => service !== target) });
  }

  return (
    <Grid container spacing={2}>
      <Grid size={{ xs: 12, xl: 5 }}>
        <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
          <Stack spacing={1.5}>
            <Typography component="h2" variant="h6">Verpackung</Typography>
            <FormControlLabel
              control={<Switch checked={extras.packingRequested} onChange={(event) => onExtrasChange({ ...extras, packingRequested: event.target.checked })} />}
              label="Verpackung erwünscht?"
            />
            <Alert severity="info">Packmaterial aus dem freigegebenen Katalog kann unten ausgewählt werden. Es wird nur der aktuelle Katalogname übernommen, kein Browserpreis als Orderpreis.</Alert>
          </Stack>
        </Paper>
      </Grid>
      <Grid size={{ xs: 12, xl: 7 }}>
        <Paper variant="outlined" sx={{ p: 2.5 }}>
          <Stack spacing={1.5}>
            <Typography component="h2" variant="h6">Leistungen</Typography>
            <Tabs value={activeKind} onChange={(_, next: "packaging" | "service") => setActiveKind(next)}>
              <Tab value="packaging" label="Packmaterial" />
              <Tab value="service" label="Bohrarbeiten / Leistungen" />
            </Tabs>
            {catalogError && <Alert severity="error">{catalogError}</Alert>}
            <Alert severity="info">Leistungsnamen und Richtpreise kommen aus der öffentlichen Safe-Katalog-API; beim Auftrag wird kein Browserpreis übernommen.</Alert>
            {visibleServices.map((service, index) => (
              <Grid container spacing={1} key={`${activeKind}-${index}`} sx={{ alignItems: "center" }}>
                <Grid size={{ xs: 12, sm: 5 }}>
                  <TextField select label="Katalogleistung" value={service.catalogId?.toString() ?? ""} onChange={(event) => {
                    const selected = catalog.find((item) => item.kind === activeKind && String(item.id) === event.target.value);
                    if (selected) updateService(index, { catalogId: selected.id, name: selected.name });
                  }}>
                    <MenuItem value="">Freitext</MenuItem>
                    {catalog.filter((item) => item.kind === activeKind).map((item) => <MenuItem key={item.id} value={String(item.id)}>{item.name}</MenuItem>)}
                  </TextField>
                </Grid>
                <Grid size={{ xs: 8, sm: 4 }}>
                  <TextField label="Leistung" value={service.name} onChange={(event) => updateService(index, { name: event.target.value })} />
                </Grid>
                <Grid size={{ xs: 3, sm: 2 }}>
                  <TextField type="number" label="Anzahl" value={service.quantity} onChange={(event) => updateService(index, { quantity: Number(event.target.value) })} />
                </Grid>
                <Grid size={{ xs: 9, sm: 1 }}>
                  <Typography variant="body2" color="text.secondary">
                    {service.catalogId === undefined ? "" : catalog.find((item) => item.id === service.catalogId && item.kind === activeKind)?.price.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}
                  </Typography>
                  <Button color="error" aria-label="Leistung entfernen" onClick={() => removeService(index)}><DeleteOutlined /></Button>
                </Grid>
              </Grid>
            ))}
            <Button startIcon={<AddOutlined />} onClick={addService} sx={{ alignSelf: "flex-start" }}>Leistung hinzufügen</Button>
          </Stack>
        </Paper>
      </Grid>
    </Grid>
  );
}
