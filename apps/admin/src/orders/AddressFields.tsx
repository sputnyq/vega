import { Alert, FormControlLabel, MenuItem, Stack, Switch, TextField, Typography } from "@mui/material";
import type { OrderAddressInput } from "@vega/domain";

const floors = ["UG", "EG", ...Array.from({ length: 8 }, (_, index) => `${index + 1}. Etage`), "9+ Etage"];
const liftTypes = ["kein Aufzug", "2 Personen", "4 Personen", "6 Personen", "8+ Personen"];
const buildings = ["Wohnung", "Haus", "Keller", "Lager", "Büro"] as const;
const parkingDistances = Array.from({ length: 10 }, (_, index) => `${(index + 1) * 10} m.`);
const areas = Array.from({ length: 15 }, (_, index) => `${(index + 1) * 10} m²`);

interface AddressFieldsProps {
  title: string;
  value: OrderAddressInput;
  onChange: (value: Partial<OrderAddressInput>) => void;
}

export function AddressFields({ title, value, onChange }: AddressFieldsProps) {
  return (
    <Stack spacing={1.25}>
      {title && <Typography component="h3" variant="h6">{title}</Typography>}
      <TextField label="Adresse" value={value.street} onChange={(event) => onChange({ street: event.target.value })} slotProps={{ htmlInput: { maxLength: 160 } }} />
      <Stack direction={{ xs: "column", sm: "row" }} spacing={1.5}>
        <TextField label="PLZ" value={value.postalCode} onChange={(event) => onChange({ postalCode: event.target.value })} slotProps={{ htmlInput: { maxLength: 16 } }} sx={{ flex: 1 }} />
        <TextField label="Ort" value={value.city} onChange={(event) => onChange({ city: event.target.value })} slotProps={{ htmlInput: { maxLength: 100 } }} sx={{ flex: 2 }} />
      </Stack>
      <TextField select label="Entfernung bis zum Parkplatz" value={value.runningDistance ?? ""} onChange={(event) => onChange({ runningDistance: event.target.value })}>
        {parkingDistances.map((distance) => <MenuItem key={distance} value={distance}>{distance}</MenuItem>)}
      </TextField>
      <FormControlLabel control={<Switch checked={value.parkingSlot ?? false} onChange={(event) => onChange({ parkingSlot: event.target.checked })} />} label="Halteverbot" />
      {value.parkingSlot && value.city && !["MÜNCHEN", "MUNICH", "MUENCHEN"].some((city) => value.city.toUpperCase().includes(city)) && (
        <Alert severity="warning">Halteverbot liegt außerhalb der Stadt.</Alert>
      )}
      <Typography color="text.secondary" variant="overline" align="center">Gebäude</Typography>
      <TextField select label="Objekt" value={value.movementObject ?? "Wohnung"} onChange={(event) => onChange({ movementObject: event.target.value as NonNullable<OrderAddressInput["movementObject"]> })}>
        {buildings.map((building) => <MenuItem key={building} value={building}>{building}</MenuItem>)}
      </TextField>
      <TextField select label="Etage" value={value.floor ?? ""} onChange={(event) => onChange({ floor: event.target.value })}>
        <MenuItem value="">Bitte wählen</MenuItem>
        {floors.map((floor) => <MenuItem key={floor} value={floor}>{floor}</MenuItem>)}
      </TextField>
      <TextField select label="Aufzug" value={value.liftType ?? "kein Aufzug"} onChange={(event) => onChange({ liftType: event.target.value })}>
        {liftTypes.map((lift) => <MenuItem key={lift} value={lift}>{lift}</MenuItem>)}
      </TextField>
      <Stack direction={{ xs: "column", sm: "row" }} useFlexGap sx={{ flexWrap: "wrap" }}>
        <FormControlLabel control={<Switch checked={value.isAltbau ?? false} onChange={(event) => onChange({ isAltbau: event.target.checked })} />} label="Altbau" />
        <FormControlLabel control={<Switch checked={value.hasLoft ?? false} onChange={(event) => onChange({ hasLoft: event.target.checked })} />} label="Dachboden" />
        <FormControlLabel control={<Switch checked={value.hasBasement ?? false} onChange={(event) => onChange({ hasBasement: event.target.checked })} />} label="Keller" />
        <FormControlLabel control={<Switch checked={value.hasGarage ?? false} onChange={(event) => onChange({ hasGarage: event.target.checked })} />} label="Garage" />
      </Stack>
      <Typography color="text.secondary" variant="overline" align="center">Wohnung</Typography>
      <TextField select label="Fläche" value={value.area ?? ""} onChange={(event) => onChange({ area: event.target.value })}>
        <MenuItem value="">Bitte wählen</MenuItem>
        {areas.map((area) => <MenuItem key={area} value={area}>{area}</MenuItem>)}
      </TextField>
      <TextField label="Zimmer" type="number" value={value.roomsNumber ?? ""} onChange={(event) => onChange({ roomsNumber: event.target.value })} />
      <TextField label="Zimmer zum Umziehen" type="number" value={value.roomsToRelocate ?? 0} onChange={(event) => onChange({ roomsToRelocate: Number(event.target.value) })} />
    </Stack>
  );
}
