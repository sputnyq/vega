import { DatePicker } from "@mui/x-date-pickers/DatePicker";
import { LocalizationProvider } from "@mui/x-date-pickers/LocalizationProvider";
import { AdapterDateFns } from "@mui/x-date-pickers/AdapterDateFns";
import { format, isValid, parseISO } from "date-fns";
import { de } from "date-fns/locale/de";
import { deDE } from "@mui/x-date-pickers/locales";
import { createTheme, ThemeProvider } from "@mui/material/styles";
import { useFieldValidation } from "./components.js";
import { theme } from "./theme.js";

const dateTheme = createTheme(theme, deDE);

export function DateField({ label, value, onChange, min }: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  min?: string;
}) {
  const validation = useFieldValidation(label);
  return (
    <ThemeProvider theme={dateTheme}>
    <LocalizationProvider dateAdapter={AdapterDateFns} adapterLocale={de}>
      <DatePicker
        label={label}
        disablePast
        {...(min ? { minDate: parseISO(min) } : {})}
        value={value ? parseISO(value) : null}
        onChange={(date) => {
          onChange(date && isValid(date) ? format(date, "yyyy-MM-dd") : "");
          if (validation.error) validation.clear();
        }}
        slotProps={{
          textField: {
            required: true,
            fullWidth: true,
            size: "small",
            error: validation.error,
            sx: { "& .MuiPickersInputBase-root": { minHeight: 43 } },
          },
        }}
      />
    </LocalizationProvider>
    </ThemeProvider>
  );
}
