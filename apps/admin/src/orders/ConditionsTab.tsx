import { AddOutlined, DeleteOutlined } from "@mui/icons-material";
import { Alert, Box, Button, Grid, IconButton, Paper, Stack, TextField, Typography } from "@mui/material";
import type { OrderConditionInput, OrderDetailsInput } from "@vega/domain";
import type { OrderFormValue } from "./order-form-types.js";

interface ConditionsTabProps {
  value: OrderFormValue;
  onConditionsChange: (conditions: OrderDetailsInput["conditions"]) => void;
}

export function ConditionsTab({ value, onConditionsChange }: ConditionsTabProps) {
  const { basis, conditions } = value.details;

  function updateEntry(index: number, patch: Partial<OrderConditionInput>) {
    onConditionsChange(conditions.map((entry, entryIndex) => entryIndex === index ? { ...entry, ...patch } : entry));
  }

  return (
    <Box sx={{ display: "grid", gridTemplateColumns: { xs: "minmax(0, 1fr)", md: "minmax(0, 1fr) minmax(0, 2fr)" }, gap: 2, alignItems: "start" }}>
      <Paper variant="outlined" sx={{ p: 2.5, minWidth: 0 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Angebotsbasis</Typography>
          <Typography color="text.secondary">Auswahl aus dem Basis-Tab</Typography>
          <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: "wrap" }}>
            <Typography component="span" variant="body2">{basis.workers} Träger</Typography>
            <Typography component="span" variant="body2">{basis.trucks} × LKW 3,5t</Typography>
            <Typography component="span" variant="body2">{basis.hours} Stunden</Typography>
          </Stack>
          <Alert severity="info">Entfernung, Halteverbotszonen und Katalogpreise werden erst mit der serverseitigen Preisberechnung zu Konditionen berechnet.</Alert>
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: 2.5, minWidth: 0 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Im Auftrag enthalten</Typography>
          {conditions.map((entry, index) => (
            <Grid container spacing={1} key={`condition-${index}`} sx={{ alignItems: "center" }}>
              <Grid size={{ xs: 12, sm: 7 }}>
                <TextField label="Beschreibung" value={entry.description} onChange={(event) => updateEntry(index, { description: event.target.value })} />
              </Grid>
              <Grid size={{ xs: 8, sm: 3 }}>
                <TextField type="number" label="Betrag (€)" value={entry.amount} onChange={(event) => updateEntry(index, { amount: Number(event.target.value) })} />
              </Grid>
              <Grid size={{ xs: 4, sm: 2 }}>
                <IconButton color="error" aria-label="Kondition entfernen" onClick={() => onConditionsChange(conditions.filter((_, entryIndex) => entryIndex !== index))}><DeleteOutlined /></IconButton>
              </Grid>
            </Grid>
          ))}
          <Button startIcon={<AddOutlined />} onClick={() => onConditionsChange([...conditions, { description: "", amount: 0 }])} sx={{ alignSelf: "flex-end" }}>
            Kondition hinzufügen
          </Button>
          <Typography variant="h6" sx={{ textAlign: "right" }}>Summe: {conditions.reduce((sum, item) => sum + item.amount, 0).toLocaleString("de-DE", { style: "currency", currency: "EUR" })}</Typography>
          <Alert severity="warning">Konditionsbeträge werden als explizite Staff-Eingaben gespeichert und serverseitig validiert. Automatische Angebotskalkulation ist noch nicht angebunden.</Alert>
        </Stack>
      </Paper>
    </Box>
  );
}
