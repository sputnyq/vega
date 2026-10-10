import assert from "node:assert/strict";
import test from "node:test";
import { meetsPasswordPolicy, passwordPolicyError, passwordPolicyHelp } from "../src/password-policy.js";

test("admin password policy matches the server rule and keeps its existing help and error text", () => {
  const cases: Array<[string, boolean]> = [
    ["Abcdef1", false],
    ["Abcdefg1", true],
    [`A${"b".repeat(126)}1`, true],
    [`A${"b".repeat(127)}1`, false],
    ["abcdefg1", false],
    ["ABCDEFG1", false],
    ["Abcdefgh", false],
    ["Äbcdefgh", false],
    ["ABCDEF1ä", false],
    [" Abcdef1 ", true],
  ];

  for (const [password, expected] of cases) assert.equal(meetsPasswordPolicy(password), expected);
  assert.equal(passwordPolicyHelp, "Mindestens 8 Zeichen, inklusive Großbuchstabe, Kleinbuchstabe und Zahl.");
  assert.equal(passwordPolicyError, "Das Passwort muss mindestens 8 Zeichen sowie einen Großbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten.");
});
