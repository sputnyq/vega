import { useEffect, useState } from "react";
import { Alert, Button, Chip, Grid, Paper, Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow, TextField, Typography } from "@mui/material";
import type { CatalogOfferDto, OrderDetailsInput } from "@vega/domain";
import { AppointmentFields } from "./AppointmentFields.js";
import { catalogRequest } from "../catalog/catalog-api.js";
import type { OrderFormValue } from "./order-form-types.js";

interface BasisTabProps {
  value: OrderFormValue;
  update: (patch: Partial<OrderFormValue>) => void;
  onBasisChange: (basis: OrderDetailsInput["basis"]) => void;
}

export function BasisTab({ value, update, onBasisChange }: BasisTabProps) {
  const basis = value.details.basis;
  const [offers, setOffers] = useState<CatalogOfferDto[]>([]);
  const [offersLoading, setOffersLoading] = useState(true);
  const [offersError, setOffersError] = useState<string | null>(null);
  const setBasis = (patch: Partial<typeof basis>) => onBasisChange({ ...basis, ...patch });

  useEffect(() => {
    let active = true;
    catalogRequest<CatalogOfferDto[]>("/api/catalog/offers")
      .then((items) => { if (active) setOffers(items); })
      .catch((cause: unknown) => { if (active) setOffersError(cause instanceof Error ? cause.message : "Angebote konnten nicht geladen werden."); })
      .finally(() => { if (active) setOffersLoading(false); });
    return () => { active = false; };
  }, []);

  return (
    <Stack spacing={2}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <AppointmentFields
              value={{
                movingDate: value.movingDate,
                movingTime: value.movingTime ?? "",
                dateFrom: value.dateFrom ?? "",
                dateTo: value.dateTo ?? "",
                dateFixed: value.dateFixed ?? false,
              }}
              onChange={update}
            />
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">Träger und LKW</Typography>
              <TextField type="number" label="Träger" value={basis.workers} onChange={(event) => setBasis({ workers: Number(event.target.value) })} />
              <TextField type="number" label="LKW 3,5" value={basis.trucks} onChange={(event) => setBasis({ trucks: Number(event.target.value) })} />
              <TextField type="number" label="Stunden" value={basis.hours} onChange={(event) => setBasis({ hours: Number(event.target.value) })} />
            </Stack>
          </Paper>
        </Grid>
        <Grid size={{ xs: 12, lg: 4 }}>
          <Paper variant="outlined" sx={{ p: 2.5, height: "100%" }}>
            <Stack spacing={1.5}>
              <Typography component="h2" variant="h6">Preis</Typography>
              <TextField type="number" label="Betrag (€)" value={basis.basePrice} onChange={(event) => setBasis({ basePrice: Number(event.target.value) })} />
              <TextField type="number" label="Stundenpreis (€)" value={basis.extraHourPrice} onChange={(event) => setBasis({ extraHourPrice: Number(event.target.value) })} />
              <TextField type="number" label="Rabatt (%)" value={basis.discountPercent} onChange={(event) => setBasis({ discountPercent: Number(event.target.value) })} />
              <Stack direction="row" spacing={1}>
                <Chip label="5 %" onClick={() => setBasis({ discountPercent: 5 })} />
                <Chip label="10 %" onClick={() => setBasis({ discountPercent: 10 })} />
              </Stack>
              <Alert severity="warning">Der Angebotspreis wird serverseitig geprüft. Automatische Rabattempfehlungen sind noch nicht angebunden.</Alert>
            </Stack>
          </Paper>
        </Grid>
      </Grid>
      <Paper variant="outlined" sx={{ p: 2.5 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Aktuelle Angebote</Typography>
          {offersError && <Alert severity="error">{offersError}</Alert>}
          {offersLoading ? <Typography color="text.secondary">Angebote werden geladen …</Typography> : (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow>
                    <TableCell>Träger</TableCell><TableCell>LKW 3,5</TableCell><TableCell>Stunden</TableCell>
                    <TableCell>Stundenpreis</TableCell><TableCell>Anfahrt</TableCell><TableCell>Gesamt</TableCell><TableCell />
                  </TableRow>
                </TableHead>
                <TableBody>
                  {offers.map((offer) => (
                    <TableRow key={offer.id}>
                      <TableCell>{offer.workers}</TableCell><TableCell>{offer.trucks}</TableCell><TableCell>{offer.includedHours}</TableCell>
                      <TableCell>{offer.hourPrice.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</TableCell>
                      <TableCell>{offer.ridingCosts.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</TableCell>
                      <TableCell>{offer.sum.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</TableCell>
                      <TableCell>
                        <Button size="small" onClick={() => onBasisChange({
                          workers: offer.workers,
                          trucks: offer.trucks,
                          hours: offer.includedHours,
                          basePrice: offer.sum,
                          extraHourPrice: offer.hourPrice,
                          discountPercent: basis.discountPercent,
                        })}>Auswählen</Button>
                      </TableCell>
                    </TableRow>
                  ))}
                  {offers.length === 0 && <TableRow><TableCell colSpan={7} align="center">Noch keine Angebote gepflegt.</TableCell></TableRow>}
                </TableBody>
              </Table>
            </TableContainer>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
