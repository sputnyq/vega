import { MenuItem, Stack, TextField, Typography } from "@mui/material";
import type { OrderFormValue } from "./order-form-types.js";

interface CustomerFieldsProps {
  value: OrderFormValue["customer"];
  onChange: (value: Partial<OrderFormValue["customer"]>) => void;
}

export function CustomerFields({ value, onChange }: CustomerFieldsProps) {
  return (
    <Stack spacing={1.5}>
      <Typography component="h2" variant="h6">Kundendaten</Typography>
      <TextField
        label="Firma"
        value={value.company ?? ""}
        onChange={(event) => onChange({ company: event.target.value })}
        slotProps={{ htmlInput: { maxLength: 160 } }}
      />
      <TextField
        select
        label="Anrede"
        value={value.salutation ?? ""}
        onChange={(event) => onChange({ salutation: event.target.value as NonNullable<OrderFormValue["customer"]["salutation"]> })}
      >
        <MenuItem value="">Keine Angabe</MenuItem>
        <MenuItem value="Herr">Herr</MenuItem>
        <MenuItem value="Frau">Frau</MenuItem>
        <MenuItem value="Divers">Divers</MenuItem>
      </TextField>
      <TextField
        label="Vorname"
        value={value.firstName}
        onChange={(event) => onChange({ firstName: event.target.value })}
        autoComplete="given-name"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <TextField
        label="Nachname"
        value={value.lastName}
        onChange={(event) => onChange({ lastName: event.target.value })}
        autoComplete="family-name"
        slotProps={{ htmlInput: { maxLength: 100 } }}
      />
      <TextField
        label="E-Mail-Adresse"
        type="email"
        value={value.email ?? ""}
        onChange={(event) => onChange({ email: event.target.value })}
        autoComplete="email"
        slotProps={{ htmlInput: { maxLength: 254 } }}
      />
      <TextField
        label="Telefon"
        type="tel"
        value={value.phone}
        onChange={(event) => onChange({ phone: event.target.value })}
        autoComplete="tel"
        slotProps={{ htmlInput: { maxLength: 64 } }}
      />
    </Stack>
  );
}
