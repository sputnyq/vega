import assert from "node:assert/strict";
import test from "node:test";
import { meetsPasswordPolicy } from "../src/password-policy.js";

test("new passwords preserve the exact length, ASCII character-class, and whitespace rules", () => {
  assert.equal(meetsPasswordPolicy("Abcdef1"), false);
  assert.equal(meetsPasswordPolicy("Abcdefg1"), true);
  assert.equal(meetsPasswordPolicy(`A${"b".repeat(126)}1`), true);
  assert.equal(meetsPasswordPolicy(`A${"b".repeat(127)}1`), false);
  assert.equal(meetsPasswordPolicy("abcdefg1"), false);
  assert.equal(meetsPasswordPolicy("ABCDEFG1"), false);
  assert.equal(meetsPasswordPolicy("Abcdefgh"), false);
  assert.equal(meetsPasswordPolicy("Äbcdefgh"), false);
  assert.equal(meetsPasswordPolicy("ABCDEF1ä"), false);
  assert.equal(meetsPasswordPolicy(" Abcdef1 "), true);
});
