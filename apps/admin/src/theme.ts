import { alpha, createTheme } from "@mui/material/styles";

const navigationColor = "#1d2a77";
const squareElements = "*:not(.MuiSwitch-root, .MuiSwitch-root *, .MuiChip-root, .MuiChip-root *, .MuiBadge-badge, .MuiBadge-badge *, .MuiCheckbox-root, .MuiCheckbox-root *)";

export const adminTheme = createTheme({
  typography: {
    fontFamily: "system-ui, sans-serif",
  },
  shape: {
    borderRadius: 0,
  },
  palette: {
    primary: {
      main: "#044fcc",
    },
    background: {
      default: "#F7F7F7",
      paper: "#FFFFFF",
    },
  },
  components: {
    MuiMenu: {
      defaultProps: {
        slotProps: {
          paper: {
            elevation: 1,
          },
        },
      },
    },
    MuiTypography: {
      styleOverrides: {
        root: ({ ownerState }) => (
          ownerState.component !== "h1"
          && /^h[2-6]$/u.test(ownerState.variant ?? "")
          && !ownerState.color
            ? { color: navigationColor }
            : {}
        ),
      },
    },
    MuiCardHeader: {
      styleOverrides: {
        title: {
          color: navigationColor,
        },
      },
    },
    MuiTabs: {
      styleOverrides: {
        root: {
          backgroundColor: alpha("#F7F7F7", 0.9),
        },
      },
    },
    MuiButton: {
      defaultProps: {
        disableElevation: true,
      },
    },
    MuiCssBaseline: {
      styleOverrides: {
        [`${squareElements}, ${squareElements}::before, ${squareElements}::after`]: {
          borderRadius: "0 !important",
        },
      },
    },
    MuiAppBar: {
      styleOverrides: {
        root: {
          backgroundColor: navigationColor,
          color: "#FFFFFF",
        },
      },
    },
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
          "&:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root):not(.MuiMenu-paper)": {
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
