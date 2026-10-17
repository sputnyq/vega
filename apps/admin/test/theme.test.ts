import assert from "node:assert/strict";
import test from "node:test";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { Alert, Typography } from "@mui/material";
import { ThemeProvider } from "@mui/material/styles";
import { adminTheme } from "../src/theme.js";

test("checkboxes use their default left alignment in both applications", () => {
  assert.equal(
    adminTheme.components?.MuiCheckbox?.styleOverrides?.root,
    undefined,
  );
  assert.equal(
    customerTheme.components?.MuiCheckbox?.styleOverrides?.root,
    undefined,
  );
});

test("admin headings use semantic colors without replacing explicit colors", () => {
  const html = renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme: adminTheme },
      createElement(
        Typography,
        { component: "h2", variant: "h6" },
        "Berechnungsoptionen",
      ),
    ),
  );
  assert.match(html, /color:var\(--mui-palette-text-primary\)/u);
  const explicit = renderToStaticMarkup(
    createElement(
      ThemeProvider,
      { theme: adminTheme },
      createElement(
        Typography,
        { component: "h2", variant: "h6", color: "error" },
        "Titel",
      ),
    ),
  );
  assert.match(explicit, /color:var\(--mui-palette-error-main\)/u);
});

test("admin typography and compact fields are preserved", () => {
  assert.match(adminTheme.typography.fontFamily, /-apple-system/u);
  assert.equal(adminTheme.typography.button.textTransform, "none");
  assert.equal(adminTheme.shape.borderRadius, 8);
  assert.equal(
    adminTheme.components?.MuiTextField?.defaultProps?.margin,
    "dense",
  );
  assert.equal(
    adminTheme.components?.MuiTextField?.defaultProps?.size,
    "small",
  );
  assert.equal(
    adminTheme.components?.MuiButton?.defaultProps?.disableElevation,
    true,
  );
});

test("light and dark schemes provide distinct legible surfaces", () => {
  const light = adminTheme.colorSchemes?.light;
  const dark = adminTheme.colorSchemes?.dark;
  assert.ok(light && dark);
  assert.equal(light.palette.background.default, "#F3F5F8");
  assert.equal(dark.palette.background.default, "#171D27");
  assert.equal(dark.palette.background.paper, "#232C3A");
  assert.equal(dark.palette.text.primary, "#EDF0F6");
  assert.equal(dark.palette.primary.main, "#91B4FF");
});

test("glass styles override their opaque fallback in both color schemes", () => {
  const appbar = adminTheme.components?.MuiAppBar?.styleOverrides?.root;
  const drawer = adminTheme.components?.MuiDrawer?.styleOverrides?.paper;
  assert.ok(typeof appbar === "object" && appbar !== null);
  assert.ok(typeof drawer === "object" && drawer !== null);
  assert.equal(appbar.backgroundColor, "var(--mui-palette-background-paper)");
  assert.deepEqual(appbar["@supports (backdrop-filter: blur(1px))"], {
    backgroundColor: "rgba(var(--mui-palette-background-paperChannel) / 0.78)",
    backdropFilter: "blur(22px) saturate(165%)",
  });
  assert.deepEqual(drawer["@supports (backdrop-filter: blur(1px))"], {
    backgroundColor: "rgba(var(--mui-palette-background-paperChannel) / 0.84)",
    backdropFilter: "blur(24px) saturate(170%)",
  });
});

test("content surfaces use opaque semantic colors", () => {
  for (const component of [
    "MuiPaper",
    "MuiCard",
    "MuiOutlinedInput",
  ] as const) {
    const root = adminTheme.components?.[component]?.styleOverrides?.root;
    assert.ok(typeof root === "object" && root !== null);
    assert.equal(root.backgroundColor, "var(--mui-palette-background-paper)");
  }
});

test("focus and reduced motion preferences work in both modes", () => {
  const baseline = adminTheme.components?.MuiCssBaseline?.styleOverrides;
  assert.ok(typeof baseline === "object" && baseline !== null);
  assert.deepEqual(baseline[":focus-visible"], {
    outline: "3px solid var(--mui-palette-primary-main)",
    outlineOffset: 2,
  });

  test("filled alerts use muted dark surfaces while preserving severity contrast", () => {
    for (const [severity, background, foreground] of [
      ["error", "#402830", "#FFDADF"],
      ["warning", "#3E3222", "#F5DDA9"],
      ["success", "#233B32", "#C4EAD6"],
      ["info", "#25364D", "#D0E1FF"],
    ] as const) {
      const html = renderToStaticMarkup(
        createElement(
          ThemeProvider,
          { theme: adminTheme },
          createElement(Alert, { variant: "filled", severity }, "Nachricht"),
        ),
      );
      assert.ok(html.includes(`background-color:${background}`));
      assert.ok(html.includes(`color:${foreground}`));
      assert.match(html, /\.dark/u);
    }
  });
  assert.deepEqual(baseline["@media (prefers-reduced-motion: reduce)"], {
    ".MuiListItemButton-root": { transition: "none !important" },
  });
});
