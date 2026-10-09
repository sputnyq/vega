import { Alert, FormControlLabel, MenuItem, Paper, Stack, Switch, TextField, Typography } from "@mui/material";
import { CustomerFields } from "./CustomerFields.js";
import type { OrderFormValue } from "./order-form-types.js";

interface CustomerTabProps {
  value: OrderFormValue;
  update: (patch: Partial<OrderFormValue>) => void;
}

export function CustomerTab({ value, update }: CustomerTabProps) {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760 }}>
        <CustomerFields value={value.customer} onChange={(customer) => update({ customer: { ...value.customer, ...customer } })} />
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Notiz</Typography>
          <TextField
            multiline
            minRows={3}
            value={value.note ?? ""}
            onChange={(event) => update({ note: event.target.value })}
            slotProps={{ htmlInput: { maxLength: 5000 } }}
          />
          <FormControlLabel
            control={<Switch checked={value.costsAssumption ?? false} onChange={(event) => update({ costsAssumption: event.target.checked })} />}
            label="Kostenübernahme durch Arbeitsamt"
          />
          {value.costsAssumption && <Alert severity="info">Für die Kostenübernahme wird meist ein Festpreisangebot benötigt.</Alert>}
          {value.visitWanted && <Alert severity="info">Der Kunde möchte wegen eines kostenlosen Besichtigungstermins kontaktiert werden.</Alert>}
          {value.privacyAccepted && <Typography variant="body2" color="text.secondary">Datenschutzerklärung bei der Anfrage bestätigt.</Typography>}
        </Stack>
      </Paper>
      <Paper variant="outlined" sx={{ p: { xs: 2, sm: 3 }, maxWidth: 760 }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h6">Auftrag</Typography>
          <Typography variant="body2" color="text.secondary">Erstellt: {new Date().toLocaleString("de-DE")}</Typography>
          <TextField
            select
            label="Quelle"
            value={value.orderSource ?? "individuelle"}
            onChange={(event) => update({ orderSource: event.target.value as NonNullable<OrderFormValue["orderSource"]> })}
          >
            <MenuItem value="express">express</MenuItem>
            <MenuItem value="individuelle">individuelle</MenuItem>
            <MenuItem value="Moebelliste">Möbelliste</MenuItem>
            <MenuItem value="UmzugRuckZuck">Umzug Ruck Zuck</MenuItem>
            <MenuItem value="check24">CHECK24</MenuItem>
            <MenuItem value="umzugruckzuck24.de">umzugruckzuck24.de</MenuItem>
          </TextField>
          {value.orderSource === "individuelle" && (
            <Alert severity="warning">Für CHECK24- und MyHammer-Anfragen die passende Auftragsquelle wählen.</Alert>
          )}
        </Stack>
      </Paper>
    </Stack>
  );
}
