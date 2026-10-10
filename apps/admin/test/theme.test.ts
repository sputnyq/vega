import assert from "node:assert/strict";
import test from "node:test";
import { adminTheme } from "../src/theme.js";

test("admin theme uses the Vega primary color and compact text fields", () => {
  assert.equal(adminTheme.palette.primary.main, "#C1CF25");
  assert.equal(adminTheme.palette.background.default, "#F7F7F7");
  assert.equal(adminTheme.palette.background.paper, "#FFFFFF");
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.margin, "dense");
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.size, "small");
});

test("admin cards use a flat light-gray surface without outlined borders", () => {
  const paper = adminTheme.components?.MuiPaper;
  assert.equal(paper?.defaultProps?.elevation, 0);
  const root = paper?.styleOverrides?.root;
  assert.ok(typeof root === "object" && root !== null);
  const styles = root as Record<string, unknown>;
  assert.deepEqual(styles["&:not(.MuiAppBar-root):not(.MuiDrawer-paper):not(.MuiAlert-root)"], {
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
