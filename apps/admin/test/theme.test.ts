import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Menu, MenuItem, Typography } from "@mui/material";
import { alpha, ThemeProvider } from "@mui/material/styles";
import { adminTheme } from "../src/theme.js";
import { theme as customerTheme } from "../../customer-form/src/theme.js";

test("checkboxes use their default left alignment in both applications", () => {
  assert.equal(adminTheme.components?.MuiCheckbox?.styleOverrides?.root, undefined);
  assert.equal(customerTheme.components?.MuiCheckbox?.styleOverrides?.root, undefined);
});

test("admin card headings match the navbar without replacing explicit status or navbar text colors", () => {
  for (const variant of ["h2", "h3", "h4", "h5", "h6"] as const) {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { theme: adminTheme },
      createElement(Typography, { component: "h2", variant }, "Berechnungsoptionen")));
    assert.match(html, /color:#1d2a77/u);
  }
  for (const props of [{ component: "h1", variant: "h6" }, { component: "h2", variant: "h6", color: "error.main" }] as const) {
    const html = renderToStaticMarkup(createElement(ThemeProvider, { theme: adminTheme },
      createElement(Typography, props, "Titel")));
    assert.doesNotMatch(html, /color:#1d2a77/u);
  }
  assert.deepEqual(adminTheme.components?.MuiCardHeader?.styleOverrides?.title, { color: "#1d2a77" });
});

test("admin tabs use a semi-transparent body-colored background", () => {
  assert.deepEqual(adminTheme.components?.MuiTabs?.styleOverrides?.root, {
    backgroundColor: alpha(adminTheme.palette.background.default, 0.9),
  });
});

test("admin theme uses system-ui for body text, headings and buttons", () => {
  assert.equal(adminTheme.typography.fontFamily, "system-ui, sans-serif");
  assert.equal(adminTheme.typography.body1.fontFamily, "system-ui, sans-serif");
  assert.equal(adminTheme.typography.h6.fontFamily, "system-ui, sans-serif");
  assert.equal(adminTheme.typography.button.fontFamily, "system-ui, sans-serif");
});

test("admin theme preserves rounded switches, badges and checkbox hover effects", () => {
  assert.equal(adminTheme.shape.borderRadius, 0);
  const squareElements = "*:not(.MuiSwitch-root, .MuiSwitch-root *, .MuiChip-root, .MuiChip-root *, .MuiBadge-badge, .MuiBadge-badge *, .MuiCheckbox-root, .MuiCheckbox-root *)";
  assert.deepEqual(adminTheme.components?.MuiCssBaseline?.styleOverrides, {
    [`${squareElements}, ${squareElements}::before, ${squareElements}::after`]: {
      borderRadius: "0 !important",
    },
  });
});

test("admin buttons have no elevation", () => {
  assert.equal(adminTheme.components?.MuiButton?.defaultProps?.disableElevation, true);
});

test("admin theme uses the Vega primary color and compact text fields", () => {
  assert.equal(adminTheme.palette.primary.main, "#044fcc");
  assert.equal(adminTheme.palette.background.default, "#F7F7F7");
  assert.equal(adminTheme.palette.background.paper, "#FFFFFF");
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.margin, "dense");
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.size, "small");
});

test("admin navigation bar uses the requested background with light foreground", () => {
  assert.deepEqual(adminTheme.components?.MuiAppBar?.styleOverrides?.root, {
    backgroundColor: "#1d2a77",
    color: "#FFFFFF",
  });
});

test("admin menus use elevation one", () => {
  assert.deepEqual(adminTheme.components?.MuiMenu?.defaultProps?.slotProps, {
    paper: { elevation: 1 },
  });
  const html = renderToStaticMarkup(createElement(ThemeProvider, { theme: adminTheme },
    createElement(Menu, { open: true, disablePortal: true, slotProps: { list: { "aria-label": "Kontoaktionen" } } },
      createElement(MenuItem, {}, "Sperren"))));
  assert.match(html, /MuiPaper-elevation1\b/u);
});

test("admin cards use a flat light-gray surface without outlined borders", () => {
  const paper = adminTheme.components?.MuiPaper;
  assert.equal(paper?.defaultProps?.elevation, 0);
  const root = paper?.styleOverrides?.root;
  assert.ok(typeof root === "object" && root !== null);
  const styles = root as Record<string, unknown>;
  assert.deepEqual(styles["&:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root):not(.MuiMenu-paper)"], {
    backgroundColor: "#FFFFFF",
    boxShadow: "none",
  });
  assert.deepEqual(styles["&.MuiPaper-outlined:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root)"], {
    border: 0,
  });
  assert.deepEqual(adminTheme.components?.MuiCard?.styleOverrides?.root, {
    backgroundColor: "#FFFFFF",
    border: 0,
    boxShadow: "none",
  });
});
