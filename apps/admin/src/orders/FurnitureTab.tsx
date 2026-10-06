import { useEffect, useState } from "react";
import { AddOutlined, DeleteOutlined } from "@mui/icons-material";
import { Alert, Button, FormControlLabel, Grid, MenuItem, Paper, Stack, Switch, Tabs, Tab, TextField, Typography } from "@mui/material";
import type { CatalogFurnitureDto, OrderFurnitureInput } from "@vega/domain";
import { catalogRequest } from "../catalog/catalog-api.js";
import type { OrderFormValue } from "./order-form-types.js";

interface FurnitureTabProps {
  value: OrderFormValue;
  update: (patch: Partial<OrderFormValue>) => void;
  onFurnitureChange: (furniture: OrderFormValue["details"]["furniture"]) => void;
}

export function FurnitureTab({ value, update, onFurnitureChange }: FurnitureTabProps) {
  const [listTab, setListTab] = useState(0);
  const [catalogFurniture, setCatalogFurniture] = useState<CatalogFurnitureDto[]>([]);
  const [catalogError, setCatalogError] = useState<string | null>(null);
  const furniture = value.details.furniture;

  useEffect(() => {
    let active = true;
    catalogRequest<CatalogFurnitureDto[]>("/api/catalog/furniture")
      .then((entries) => { if (active) setCatalogFurniture(entries); })
      .catch((cause: unknown) => { if (active) setCatalogError(cause instanceof Error ? cause.message : "Möbelkatalog konnte nicht geladen werden."); });
    return () => { active = false; };
  }, []);

  function updateFurniture(patch: Partial<typeof furniture>) {
    onFurnitureChange({ ...furniture, ...patch });
  }

  function addItem() {
    updateFurniture({ items: [...furniture.items, { name: "", quantity: 1, volume: 0 }] });
  }

  function updateItem(index: number, patch: Partial<OrderFurnitureInput>) {
    updateFurniture({ items: furniture.items.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item) });
  }

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">Auszug</Typography>
              <FormControlLabel control={<Switch checked={value.from.packservice ?? false} onChange={(event) => update({ from: { ...value.from, packservice: event.target.checked } })} />} label="Einpacken erwünscht?" />
              <FormControlLabel control={<Switch checked={value.from.demontage ?? false} onChange={(event) => update({ from: { ...value.from, demontage: event.target.checked } })} />} label="Abbau erwünscht?" />
              <TextField type="number" label="Betten" value={value.from.bedNumber ?? 0} onChange={(event) => update({ from: { ...value.from, bedNumber: Number(event.target.value) } })} />
              <TextField type="number" label="Schränke-Gesamtbreite, m" value={value.from.wardrobeWidth ?? 0} onChange={(event) => update({ from: { ...value.from, wardrobeWidth: Number(event.target.value) } })} />
              <TextField type="number" label="Küche-Gesamtbreite, m" value={value.from.kitchenWidth ?? 0} onChange={(event) => update({ from: { ...value.from, kitchenWidth: Number(event.target.value) } })} />
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">Einzug</Typography>
              <FormControlLabel control={<Switch checked={value.to.packservice ?? false} onChange={(event) => update({ to: { ...value.to, packservice: event.target.checked } })} />} label="Auspacken erwünscht?" />
              <FormControlLabel control={<Switch checked={value.to.montage ?? false} onChange={(event) => update({ to: { ...value.to, montage: event.target.checked } })} />} label="Aufbau erwünscht?" />
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, md: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">Kartons</Typography>
              <TextField type="number" label="Kartons" value={furniture.boxes} onChange={(event) => updateFurniture({ boxes: Number(event.target.value) })} />
              <TextField type="number" label="Kleiderboxen" value={furniture.wardrobeBoxes} onChange={(event) => updateFurniture({ wardrobeBoxes: Number(event.target.value) })} />
            </Stack>
          </Paper>
        </Grid>
      </Grid>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Besondere Gegenstände</Typography>
          <Alert severity="info">Das berechnete Umzugsvolumen beinhaltet keine besonderen Gegenstände.</Alert>
          <FormControlLabel control={<Switch checked={furniture.expensive} onChange={(event) => updateFurniture({ expensive: event.target.checked })} />} label="Antik/Wertvoll angegeben?" />
          {furniture.expensive && <TextField multiline minRows={2} label="Besonders wertvolle Gegenstände" value={furniture.expensiveText} onChange={(event) => updateFurniture({ expensiveText: event.target.value })} />}
          <FormControlLabel control={<Switch checked={furniture.heavy} onChange={(event) => updateFurniture({ heavy: event.target.checked })} />} label="Besonders schwer angegeben?" />
          {furniture.heavy && <TextField multiline minRows={2} label="Besonders schwere Gegenstände" value={furniture.heavyText} onChange={(event) => updateFurniture({ heavyText: event.target.value })} />}
          <FormControlLabel control={<Switch checked={furniture.bulky} onChange={(event) => updateFurniture({ bulky: event.target.checked })} />} label="Sperrige Gegenstände angegeben?" />
          {furniture.bulky && <TextField multiline minRows={2} label="Sperrige Gegenstände" value={furniture.bulkyText} onChange={(event) => updateFurniture({ bulkyText: event.target.value })} />}
        </Stack>
      </Paper>

      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Möbelliste</Typography>
          <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
            <TextField type="number" label="Berechnetes Umzugsvolumen (m³)" value={furniture.volume} onChange={(event) => updateFurniture({ volume: Number(event.target.value) })} />
            <Button disabled startIcon={<AddOutlined />}>Anhänge</Button>
          </Stack>
          <Tabs value={listTab} onChange={(_, next: number) => setListTab(next)} variant="scrollable" allowScrollButtonsMobile>
            <Tab label="Übertragene Liste" />
            <Tab label="Manuelle Liste" />
          </Tabs>
          {listTab === 0 ? (
            <Stack spacing={1.5}>
              {catalogError && <Alert severity="error">{catalogError}</Alert>}
              <Alert severity="info">Katalogpositionen werden über den öffentlichen Safe-GET geladen. Zusätzlich können Sie freie Möbelpositionen ergänzen.</Alert>
              {furniture.items.map((item, index) => (
                <Grid container spacing={1} key={`item-${index}`} sx={{ alignItems: "center" }}>
                  <Grid size={{ xs: 12, sm: 4 }}>
                    <TextField select label="Katalogmöbel (optional)" value={item.catalogId?.toString() ?? ""} onChange={(event) => {
                      const selected = catalogFurniture.find((entry) => String(entry.id) === event.target.value);
                      if (selected) updateItem(index, {
                        catalogId: selected.id,
                        name: selected.name,
                        volume: selected.volume,
                        ...(selected.categoryRefs[0] ? { category: selected.categoryRefs[0].name } : {}),
                      });
                    }}>
                      <MenuItem value="">Freie Position</MenuItem>
                      {catalogFurniture.map((entry) => <MenuItem key={entry.id} value={String(entry.id)}>{entry.name}</MenuItem>)}
                    </TextField>
                  </Grid>
                  <Grid size={{ xs: 12, sm: 3 }}><TextField label="Möbel / Beschreibung" value={item.name} onChange={(event) => updateItem(index, { name: event.target.value })} /></Grid>
                  <Grid size={{ xs: 5, sm: 2 }}><TextField type="number" label="Anzahl" value={item.quantity} onChange={(event) => updateItem(index, { quantity: Number(event.target.value) })} /></Grid>
                  <Grid size={{ xs: 5, sm: 2 }}><TextField type="number" label="m³" value={item.volume ?? 0} onChange={(event) => updateItem(index, { volume: Number(event.target.value) })} /></Grid>
                  <Grid size={{ xs: 2, sm: 1 }}><Button color="error" aria-label="Möbelposition löschen" onClick={() => updateFurniture({ items: furniture.items.filter((_, itemIndex) => itemIndex !== index) })}><DeleteOutlined /></Button></Grid>
                </Grid>
              ))}
              <Button startIcon={<AddOutlined />} onClick={addItem} sx={{ alignSelf: "flex-start" }}>Möbel hinzufügen</Button>
            </Stack>
          ) : (
            <TextField multiline minRows={8} label="Manuelle Möbelliste" value={furniture.ownItems} onChange={(event) => updateFurniture({ ownItems: event.target.value })} />
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
