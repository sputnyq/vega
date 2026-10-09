import { createTheme } from "@mui/material/styles";
import { deDE } from "@mui/x-date-pickers/locales";

export const theme = createTheme({
  palette: { primary: { main: "#1774BF" } },
  shape: { borderRadius: 5 },
  typography: { fontFamily: '"Montserrat","Arial",sans-serif', fontSize: 14, fontWeightRegular: 400 },
  components: {
    MuiFormLabel: { styleOverrides: { root: { color: "#1a1a1a", fontWeight: 400 } } },
    MuiTextField: { defaultProps: { margin: "dense", size: "small", fullWidth: true, variant: "outlined" } },
  },
}, deDE);
