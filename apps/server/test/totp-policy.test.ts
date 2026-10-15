import assert from "node:assert/strict";
import test from "node:test";
import { isTotpRequired, needsTotpSetup } from "@vega/domain";

test("TOTP is mandatory for admins and optional for Kundenberater", () => {
  assert.equal(isTotpRequired("Admin"), true);
  assert.equal(isTotpRequired("Kundenberater"), false);
  assert.equal(isTotpRequired("unknown"), true);
  assert.equal(needsTotpSetup({ role: "Admin", twoFactorEnabled: false }), true);
  assert.equal(needsTotpSetup({ role: "Admin", twoFactorEnabled: null }), true);
  assert.equal(needsTotpSetup({ role: "Admin", twoFactorEnabled: true }), false);
  assert.equal(needsTotpSetup({ role: "Kundenberater", twoFactorEnabled: false }), false);
});
