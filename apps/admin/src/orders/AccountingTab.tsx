import { useState } from "react";
import { Alert, Button, Grid, Paper, Stack, Tab, Tabs, TextField, Typography } from "@mui/material";

const accountingTabs = ["Rechnung", "1. Mahnung", "2. Mahnung", "3. Mahnung", "Gutschrift"];

export function AccountingTab({ orderNumber, navigate }: { orderNumber?: number; navigate: (path: string) => void }) {
  const [tab, setTab] = useState(0);
  const [error, setError] = useState("");
  async function createInvoice() {
    if (orderNumber === undefined) return;
    const response = await fetch(`/api/admin/invoices/from-order/${orderNumber}`, { method: "POST" });
    const body = await response.json() as { data?: { id?: string }; error?: { message?: string } };
    if (!response.ok || !body.data?.id) { setError(body.error?.message ?? "Rechnung konnte nicht angelegt werden."); return; }
    navigate(`/invoices/${body.data.id}`);
  }

  return (
    <Stack spacing={2}>
      <Tabs value={tab} onChange={(_, value: number) => setTab(value)} variant="scrollable" allowScrollButtonsMobile>
        {accountingTabs.map((label) => <Tab key={label} label={label} />)}
      </Tabs>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 } }}>
        <Stack spacing={2}>
          <Typography component="h2" variant="h6">{accountingTabs[tab]}</Typography>
          {error && <Alert severity="error">{error}</Alert>}
          {tab === 0 ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 4 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">Kunde und Rechnungsdaten</Typography>
                  <TextField label="Kunde" disabled />
                  <TextField label="Straße, Nr." disabled />
                  <TextField label="PLZ, Ort" disabled />
                  <TextField label="Rechnungsdatum" type="date" disabled slotProps={{ inputLabel: { shrink: true } }} />
                  <TextField label="Rechnungsnummer" disabled />
                </Stack>
              </Grid>
              <Grid size={{ xs: 12, lg: 8 }}>
                <Stack spacing={1.5}>
                  <Typography variant="subtitle1">Rechnungstext und Leistungen</Typography>
                  <TextField label="Rechnungstext" multiline minRows={3} disabled />
                  <TextField label="Rechnungspositionen" multiline minRows={4} disabled />
                  {orderNumber !== undefined && <Button variant="contained" onClick={() => void createInvoice()}>Rechnung aus Auftrag anlegen</Button>}
                </Stack>
              </Grid>
            </Grid>
          ) : tab === 4 ? (
            <Grid container spacing={2}>
              <Grid size={{ xs: 12, lg: 4 }}><Stack spacing={1.5}><TextField label="Gutschrift-Datum" type="date" disabled slotProps={{ inputLabel: { shrink: true } }} /><TextField label="Gutschriftnummer" disabled /></Stack></Grid>
              <Grid size={{ xs: 12, lg: 8 }}><TextField fullWidth label="Text" multiline minRows={3} disabled /></Grid>
            </Grid>
          ) : (
            <Stack spacing={1.5}>
              <TextField label="Fälligkeit und Mahnungstext" multiline minRows={3} disabled />
              <Button disabled sx={{ alignSelf: "flex-start" }}>Mahnung erstellen</Button>
            </Stack>
          )}
          <Alert severity="info">
            Rechnungen, Mahnungen und Gutschriften sind in Vega eigenständige Finanzbelege mit eigener Nummerierung und Aufbewahrung. Ihre Erstellung wird über die Finanzbeleg-API angebunden und nicht mehr im neuen Auftrag gespeichert.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}
