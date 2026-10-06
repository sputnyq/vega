import { useState } from "react";
import { IconButton, InputAdornment, TextField } from "@mui/material";
import VisibilityIcon from "@mui/icons-material/Visibility";
import VisibilityOffIcon from "@mui/icons-material/VisibilityOff";

export function PasswordField({
  autoComplete,
  autoFocus,
  helperText,
  label,
  maxLength,
  minLength,
  onChange,
  value,
}: {
  autoComplete: string;
  autoFocus?: boolean;
  helperText?: string;
  label: string;
  maxLength?: number;
  minLength?: number;
  onChange: (value: string) => void;
  value: string;
}) {
  const [visible, setVisible] = useState(false);

  return (
    <TextField
      autoComplete={autoComplete}
      autoFocus={autoFocus}
      helperText={helperText}
      label={label}
      type={visible ? "text" : "password"}
      value={value}
      onChange={(event) => onChange(event.target.value)}
      required
      slotProps={{
        htmlInput: {
          autoComplete,
          ...(minLength !== undefined ? { minLength } : {}),
          ...(maxLength !== undefined ? { maxLength } : {}),
        },
        input: {
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label={visible ? "Passwort verbergen" : "Passwort anzeigen"}
                edge="end"
                type="button"
                onClick={() => setVisible((current) => !current)}
                onMouseDown={(event) => event.preventDefault()}
                size="small"
              >
                {visible ? <VisibilityOffIcon fontSize="small" /> : <VisibilityIcon fontSize="small" />}
              </IconButton>
            </InputAdornment>
          ),
        },
      }}
    />
  );
}
