import { Alert, Autocomplete, TextField } from "@mui/material";
import { usePlaceAutocomplete, type PlaceAddress } from "./usePlaceAutocomplete.js";

interface PlaceAutocompleteFieldProps {
  label: string;
  value: string;
  maxLength: number;
  onInput: (value: string) => void;
  onSelect: (address: PlaceAddress) => void;
  disabled?: boolean;
  error?: string | undefined;
  helperText?: string | undefined;
  onBlur?: ((badInput: boolean) => void) | undefined;
}

/** Street input with Places suggestions; manual entry always remains possible. */
export function PlaceAutocompleteField({ label, value, maxLength, onInput, onSelect, disabled = false, error, helperText, onBlur }: PlaceAutocompleteFieldProps) {
  const { options, setQuery, error: placesError, select, abortSelection } = usePlaceAutocomplete(onSelect);
  return <>
    <Autocomplete freeSolo options={options} filterOptions={(items) => items}
      getOptionLabel={(item) => typeof item === "string" ? item : item.label}
      inputValue={value} value={null} disabled={disabled}
      onInputChange={(_, nextValue, reason) => {
        if (reason === "input" || reason === "clear") {
          abortSelection();
          onInput(nextValue);
          setQuery(nextValue);
        }
      }}
      onChange={(_, selected) => {
        if (selected && typeof selected !== "string") void select(selected.id);
      }}
      renderInput={(params) => <TextField {...params} label={label} fullWidth
        error={Boolean(error)} helperText={error ?? helperText}
        onBlur={onBlur ? (event) => onBlur(event.currentTarget.validity.badInput) : undefined}
        slotProps={{ ...params.slotProps, htmlInput: { ...params.slotProps.htmlInput, maxLength } }} />}
    />
    {placesError && <Alert severity="info">{placesError} Die manuelle Eingabe bleibt möglich.</Alert>}
  </>;
}
