import { useEffect, useRef, useState } from "react";
import { Alert, Autocomplete, Grid, MenuItem } from "@mui/material";
import type { OrderAddressInput } from "@vega/domain";
import type { AddressDraft } from "./form-model.js";
import { request } from "./api.js";
import { Field } from "./components.js";

export function AddressFields({ address, update, autocomplete }: { address: AddressDraft; update: (patch: Partial<AddressDraft>) => void; autocomplete: boolean }) {
  const [options, setOptions] = useState<Array<{ id: string; label: string }>>([]);
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");
  const session = useRef(crypto.randomUUID());
  const selection = useRef<AbortController | null>(null);
  useEffect(() => {
    if (!autocomplete || query.length < 3) { setOptions([]); return; }
    const controller = new AbortController();
    const timer = setTimeout(() => {
      void request<Array<{ id: string; label: string }>>("/api/customer-form/places/autocomplete", { input: query, sessionToken: session.current }, controller.signal)
        .then((result) => { setOptions(result); setError(""); })
        .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Die Adresssuche ist fehlgeschlagen."); });
    }, 300);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [query, autocomplete]);
  useEffect(() => () => selection.current?.abort(), []);
  return <Grid container spacing={2}>
    <Grid size={12}>
      <Autocomplete freeSolo disabled={false} options={options} filterOptions={(items) => items}
        getOptionLabel={(item) => typeof item === "string" ? item : item.label}
        inputValue={address.street} value={null}
        onInputChange={(_, value, reason) => {
          if (reason === "input" || reason === "clear") {
            selection.current?.abort(); update({ street: value }); setQuery(value);
          }
        }}
        onChange={(_, value) => {
          if (!value || typeof value === "string") return;
          selection.current?.abort();
          const controller = new AbortController();
          selection.current = controller;
          setQuery(""); setOptions([]);
          void request<Pick<OrderAddressInput, "street" | "postalCode" | "city">>("/api/customer-form/places/address",
            { id: value.id, sessionToken: session.current }, controller.signal)
            .then((result) => { if (!controller.signal.aborted) { update(result); session.current = crypto.randomUUID(); setError(""); } })
            .catch((reason: unknown) => { if (!controller.signal.aborted) setError(reason instanceof Error ? reason.message : "Die Adresse konnte nicht übernommen werden."); });
        }}
        renderInput={(params) => <Field {...params} required label="Straße und Hausnummer" />}
      />
    </Grid>
    <Grid size={{ xs: 12, sm: 4 }}><Field required label="PLZ" value={address.postalCode} onChange={(event) => update({ postalCode: event.target.value })} /></Grid>
    <Grid size={{ xs: 12, sm: 8 }}><Field required label="Ort" value={address.city} onChange={(event) => update({ city: event.target.value })} /></Grid>
    {error && <Grid size={12}><Alert severity="error">{error} Die manuelle Eingabe ist weiterhin möglich.</Alert></Grid>}
  </Grid>;
}

export function SelectField({ label, value, options, onChange, required = true }: { label: string; value: string | undefined; options: string[]; onChange: (value: string) => void; required?: boolean }) {
  return <Field select required={required} label={label} value={value ?? ""} onChange={(event) => onChange(event.target.value)}>
    {options.map((option) => <MenuItem key={option} value={option}>{option}</MenuItem>)}
  </Field>;
}
