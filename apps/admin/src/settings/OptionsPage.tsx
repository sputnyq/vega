import { Alert, Paper, Stack, Typography } from "@mui/material";

export function OptionsPage() {
  return (
    <Stack spacing={2}>
      <Paper variant="outlined" sx={{ p: { xs: 3, sm: 4 } }}>
        <Stack spacing={1.5}>
          <Typography component="h2" variant="h5">Vorhandene Optionen</Typography>
          <Typography color="text.secondary">
            Dieser Bereich entspricht der bisherigen Einstellungsseite: Berechnungsoptionen
            (Karton- und Kleiderboxvolumen) sowie freigegebene betriebliche Einstellungen.
          </Typography>
          <Alert severity="info">
            Provider-Zugangsdaten und andere Geheimnisse werden hier nicht verwaltet. Die Felder
            werden angebunden, sobald der Vega-Einstellungs-API-Vertrag umgesetzt ist.
          </Alert>
        </Stack>
      </Paper>
    </Stack>
  );
}
