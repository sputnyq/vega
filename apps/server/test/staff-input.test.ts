import assert from "node:assert/strict";
import test from "node:test";
import { validateStaffAction, validateStaffCreate } from "../src/staff/staff-input.js";

test("staff creation allowlists roles/fields and enforces initial password policy", () => {
  const input = { name: " Test ", email: " Test@Example.test ", role: "Admin", initialPassword: "Test-only-password1", currentPassword: "Test-admin-password1" };
  assert.deepEqual(validateStaffCreate(input), { name: "Test", email: "test@example.test", role: "Admin", initialPassword: input.initialPassword });
  for (const patch of [{ role: "owner" }, { blocked: false }, { initialPassword: "weak" }, { email: "invalid" }, { name: "" }, { twoFactorEnabled: true }]) {
    assert.equal(validateStaffCreate({ ...input, ...patch }), null);
  }
  assert.equal(validateStaffCreate(null), null);
});
test("staff actions reject mass assignment, arbitrary roles and malformed boolean states", () => {
  assert.deepEqual(validateStaffAction({ kind: "block", blocked: true }), { kind: "block", blocked: true });
  for (const input of [null, {}, { kind: "delete" }, { kind: "role", role: "owner" }, { kind: "block", blocked: "true" }, { kind: "reset-totp", twoFactorEnabled: true }]) {
    assert.equal(validateStaffAction(input), null);
  }
});
