import { createTheme } from "@mui/material/styles";

export const adminTheme = createTheme({
  palette: {
    primary: {
      main: "#C1CF25",
    },
    background: {
      default: "#F7F7F7",
      paper: "#FFFFFF",
    },
  },
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
    MuiPaper: {
      defaultProps: {
        elevation: 0,
      },
      styleOverrides: {
        root: {
          "&:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root)": {
            backgroundColor: "#FFFFFF",
            boxShadow: "none",
          },
          "&.MuiPaper-outlined:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root)":
            {
              border: 0,
            },
        },
      },
    },
    MuiCard: {
      styleOverrides: {
        root: {
          backgroundColor: "#FFFFFF",
          border: 0,
          boxShadow: "none",
        },
      },
    },
  },
});
