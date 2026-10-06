import assert from "node:assert/strict";
import test from "node:test";
import { meetsPasswordPolicy } from "../src/password-policy.js";

test("new passwords require eight characters, uppercase, lowercase, and a digit", () => {
  assert.equal(meetsPasswordPolicy("Abcdefg1"), true);
  assert.equal(meetsPasswordPolicy("Abcdef1"), false);
  assert.equal(meetsPasswordPolicy("abcdefg1"), false);
  assert.equal(meetsPasswordPolicy("ABCDEFG1"), false);
  assert.equal(meetsPasswordPolicy("Abcdefgh"), false);
  assert.equal(meetsPasswordPolicy(`Abcdefg1${"x".repeat(121)}`), false);
});
