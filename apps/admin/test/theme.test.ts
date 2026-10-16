import assert from "node:assert/strict";
import test from "node:test";
import { adminTheme } from "../src/theme.js";

test("admin theme keeps text fields compact by default", () => {
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.margin, "dense");
  assert.equal(adminTheme.components?.MuiTextField?.defaultProps?.size, "small");
});
