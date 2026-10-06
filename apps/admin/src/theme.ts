import { createTheme } from "@mui/material/styles";

export const adminTheme = createTheme({
  components: {
    MuiTextField: {
      defaultProps: {
        margin: "dense",
        size: "small",
      },
    },
    MuiFormControl: {
      defaultProps: {
        margin: "dense",
      },
    },
  },
});
