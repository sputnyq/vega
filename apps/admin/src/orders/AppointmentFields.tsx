import { FormControlLabel, Stack, Switch, TextField, Typography } from "@mui/material";
import type { OrderFormValue } from "./order-form-types.js";

interface AppointmentFieldsProps {
  value: { movingDate: string; movingTime: string; dateFrom: string; dateTo: string; dateFixed: boolean };
  onChange: (value: Partial<OrderFormValue>) => void;
}

export function AppointmentFields({ value, onChange }: AppointmentFieldsProps) {
  return (
    <Stack spacing={1.5}>
      <Typography component="h2" variant="h6">Termin und Hinweise</Typography>
      <TextField
        type="date"
        label="Umzugsdatum"
        value={value.movingDate}
        onChange={(event) => onChange({ movingDate: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <FormControlLabel
        control={<Switch checked={value.dateFixed} onChange={(event) => onChange({ dateFixed: event.target.checked })} />}
        label="Termin ist verbindlich"
      />
      <Typography color="text.secondary" variant="overline">Alternativer Zeitraum (optional)</Typography>
      <TextField
        type="date"
        label="Von"
        value={value.dateFrom}
        onChange={(event) => onChange({ dateFrom: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        type="date"
        label="Bis"
        value={value.dateTo}
        onChange={(event) => onChange({ dateTo: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
      <TextField
        type="time"
        label="Gewünschte Uhrzeit"
        value={value.movingTime}
        onChange={(event) => onChange({ movingTime: event.target.value })}
        slotProps={{ inputLabel: { shrink: true } }}
      />
    </Stack>
  );
}
