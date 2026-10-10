import { useEffect, useState } from "react";
import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  CardHeader,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  Stack,
  TextField,
  Typography,
} from "@mui/material";
import { AddOutlined, BoyOutlined, DeleteOutlined, LocalShippingOutlined } from "@mui/icons-material";
import type { CatalogOfferDto } from "@vega/domain";
import { useCatalogCollection } from "./useCatalogCollection.js";

const offerGroups = [
  { trucks: 1, workers: [2, 3, 4] },
  { trucks: 2, workers: [3, 4, 5, 6, 7, 8] },
  { trucks: 3, workers: [5, 6, 7, 8] },
  { trucks: 4, workers: [7, 8, 9, 10] },
] as const;

const money = (value: number) => value.toLocaleString("de-DE", { style: "currency", currency: "EUR" });

interface OfferCardProps {
  trucks: number;
  workers: number;
  offers: CatalogOfferDto[];
  loading: boolean;
  disabled: boolean;
  create: (offer: Omit<CatalogOfferDto, "id">) => Promise<void>;
  update: (offer: CatalogOfferDto, patch: Partial<CatalogOfferDto>) => Promise<void>;
  remove: (offer: CatalogOfferDto) => Promise<void>;
  onError: (cause: unknown) => void;
}

export function OffersPage() {
  const catalog = useCatalogCollection<CatalogOfferDto>("offers");

  async function create(offer: Omit<CatalogOfferDto, "id">) {
    await catalog.create(offer);
  }

  async function update(offer: CatalogOfferDto, patch: Partial<CatalogOfferDto>) {
    const { id, ...current } = offer;
    await catalog.update(id, { ...current, ...patch });
  }

  async function remove(offer: CatalogOfferDto) {
    await catalog.remove(offer.id);
  }

  async function recover(cause: unknown) {
    await catalog.reload();
    catalog.setError(cause instanceof Error ? cause.message : "Das Angebot konnte nicht gespeichert werden.");
  }

  return (
    <Stack spacing={2}>
      {catalog.error && <Alert severity="error">{catalog.error}</Alert>}
      {offerGroups.map(({ trucks, workers }) => (
        <Box key={trucks}>
          <Typography component="h2" variant="h4" sx={{ mb: 1 }}>{trucks} LKW</Typography>
          <Grid container spacing={2}>
            {workers.map((workerCount) => (
              <Grid key={`${trucks}-${workerCount}`} size={{ xs: 12, sm: 6, md: 4 }}>
                <OfferCard
                  trucks={trucks}
                  workers={workerCount}
                  offers={catalog.items.filter((offer) => offer.trucks === trucks && offer.workers === workerCount)}
                  loading={catalog.loading}
                  disabled={catalog.loading || Boolean(catalog.error)}
                  create={create}
                  update={update}
                  remove={remove}
                  onError={(cause) => void recover(cause)}
                />
              </Grid>
            ))}
          </Grid>
        </Box>
      ))}
    </Stack>
  );
}

function OfferCard({ trucks, workers, offers, loading, disabled, create, update, remove, onError }: OfferCardProps) {
  const entries = [...offers].sort((left, right) => right.includedHours - left.includedHours);
  const [ridingCosts, setRidingCosts] = useState(String(entries[0]?.ridingCosts ?? 0));
  const [hourPrice, setHourPrice] = useState(String(entries[0]?.hourPrice ?? 0));
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setRidingCosts(String(entries[0]?.ridingCosts ?? 0));
    setHourPrice(String(entries[0]?.hourPrice ?? 0));
  }, [entries[0]?.ridingCosts, entries[0]?.hourPrice]);

  async function updateSharedRate(field: "ridingCosts" | "hourPrice", value: string) {
    if (!entries.length) return;
    const price = Number(value);
    if (!value.trim() || !Number.isFinite(price) || price < 0 || Math.round(price * 100) !== price * 100) {
      onError(new Error("Bitte geben Sie einen gültigen Preis mit höchstens zwei Nachkommastellen ein."));
      return;
    }
    if (entries.every((offer) => offer[field] === price)) return;
    setSaving(true);
    try {
      await Promise.all(entries.map((offer) => update(offer, { [field]: price })));
    } catch (cause) {
      onError(cause);
    } finally {
      setSaving(false);
    }
  }

  async function addOffer() {
    const occupiedHours = new Set(offers.map((offer) => offer.includedHours));
    const includedHours = Array.from({ length: 24 }, (_, index) => index + 1).find((hours) => !occupiedHours.has(hours));
    if (includedHours === undefined) {
      onError(new Error("Für diese Kombination sind bereits alle 24 Stundenstufen angelegt."));
      return;
    }
    setSaving(true);
    try {
      await create({
        name: `${workers} Träger · ${trucks} LKW`,
        workers,
        trucks,
        includedHours,
        sum: 0,
        hourPrice: Number(hourPrice) || 0,
        ridingCosts: Number(ridingCosts) || 0,
        sort: Math.max(0, ...offers.map((offer) => offer.sort)) + 1,
      });
    } catch (cause) {
      onError(cause);
    } finally {
      setSaving(false);
    }
  }

  async function deleteOffer(offer: CatalogOfferDto) {
    if (!window.confirm("Möchten Sie dieses Angebot wirklich löschen?")) return;
    setSaving(true);
    try {
      await remove(offer);
    } catch (cause) {
      onError(cause);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card variant="outlined" elevation={0} sx={{ height: "100%" }}>
      <CardHeader
        sx={{ p: 1 }}
        title={
          <Box sx={{ display: "flex", justifyContent: "center", width: "100%" }}>
            <Box sx={{ display: "flex", gap: 1, alignItems: "center" }}>
              <Typography variant="h5">{workers}</Typography>
              <BoyOutlined fontSize="large" />
              <Divider orientation="vertical" flexItem />
              <Typography variant="h5">{trucks}</Typography>
              <LocalShippingOutlined fontSize="large" />
            </Box>
          </Box>
        }
      />
      <CardContent>
        <Stack spacing={1.5}>
          <Grid container spacing={1.5} sx={{ pt: 1 }}>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Anfahrtskosten"
                value={ridingCosts}
                disabled={disabled || saving || entries.length === 0}
                onChange={(event) => setRidingCosts(event.target.value)}
                onBlur={() => void updateSharedRate("ridingCosts", ridingCosts)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" }, input: { endAdornment: "€" } }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                fullWidth
                type="number"
                label="Stundenpreis"
                value={hourPrice}
                disabled={disabled || saving || entries.length === 0}
                onChange={(event) => setHourPrice(event.target.value)}
                onBlur={() => void updateSharedRate("hourPrice", hourPrice)}
                slotProps={{ htmlInput: { min: 0, step: "0.01" }, input: { endAdornment: <InputAdornment position="end">€/Std</InputAdornment> } }}
              />
            </Grid>
          </Grid>
          <Box>
            <Button
              size="small"
              startIcon={<AddOutlined />}
              aria-label={`Angebot hinzufügen (${trucks} LKW, ${workers} Träger)`}
              disabled={disabled || saving}
              onClick={() => void addOffer()}
            >
              Angebot hinzufügen
            </Button>
          </Box>
          {loading ? (
            <Typography color="text.secondary">Wird geladen …</Typography>
          ) : entries.length === 0 ? (
            <Typography color="text.secondary" align="center">Noch keine Angebote.</Typography>
          ) : (
            <Stack spacing={1}>
              {entries.map((offer) => (
                <OfferRow
                  key={offer.id}
                  offer={offer}
                  disabled={disabled || saving}
                  update={update}
                  remove={() => void deleteOffer(offer)}
                  onError={onError}
                />
              ))}
            </Stack>
          )}
        </Stack>
      </CardContent>
    </Card>
  );
}

interface OfferRowProps {
  offer: CatalogOfferDto;
  disabled: boolean;
  update: OfferCardProps["update"];
  remove: () => void;
  onError: (cause: unknown) => void;
}

function OfferRow({ offer, disabled, update, remove, onError }: OfferRowProps) {
  const [hours, setHours] = useState(String(offer.includedHours));
  const [sum, setSum] = useState(String(offer.sum));

  useEffect(() => {
    setHours(String(offer.includedHours));
    setSum(String(offer.sum));
  }, [offer.includedHours, offer.sum]);

  async function save(field: "includedHours" | "sum", value: string) {
    const parsed = Number(value);
    const invalidHours = field === "includedHours" && (!Number.isInteger(parsed) || parsed < 1 || parsed > 24);
    const invalidSum = field === "sum" && Math.round(parsed * 100) !== parsed * 100;
    if (!value.trim() || !Number.isFinite(parsed) || parsed < 0 || invalidHours || invalidSum) {
      const message = field === "includedHours"
        ? "Bitte geben Sie eine ganze Stundenzahl zwischen 1 und 24 ein."
        : "Bitte geben Sie einen gültigen Gesamtpreis mit höchstens zwei Nachkommastellen ein.";
      onError(new Error(message));
      return;
    }
    if (offer[field] === parsed) return;
    try {
      await update(offer, { [field]: parsed });
    } catch (cause) {
      onError(cause);
    }
  }

  return (
    <Box sx={{ py: 1, borderBottom: 1, borderColor: "divider" }}>
      <Stack spacing={0.5}>
        <Stack direction="row" spacing={1} sx={{ alignItems: "center", justifyContent: "space-between" }}>
          <Typography variant="body2">Anfahrt: {money(offer.ridingCosts)}</Typography>
          <Typography variant="body2">Stundenpreis: {money(offer.hourPrice)} / Std</Typography>
          <IconButton color="error" size="small" aria-label="Angebot löschen" disabled={disabled} onClick={remove}>
            <DeleteOutlined />
          </IconButton>
        </Stack>
        <Grid container spacing={1}>
          <Grid size={{ xs: 5 }}>
            <TextField
              fullWidth
              type="number"
              label="Stunden"
              aria-label="Inklusive Stunden"
              value={hours}
              disabled={disabled}
              onChange={(event) => setHours(event.target.value)}
              onBlur={() => void save("includedHours", hours)}
              slotProps={{ htmlInput: { min: 1, max: 24, step: 1 } }}
            />
          </Grid>
          <Grid size={{ xs: 7 }}>
            <TextField
              fullWidth
              type="number"
              label="Gesamt"
              aria-label="Gesamtpreis"
              value={sum}
              disabled={disabled}
              onChange={(event) => setSum(event.target.value)}
              onBlur={() => void save("sum", sum)}
              slotProps={{ htmlInput: { min: 0, step: "0.01" }, input: { endAdornment: "€" } }}
            />
          </Grid>
        </Grid>
      </Stack>
    </Box>
  );
}
