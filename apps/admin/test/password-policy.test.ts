import assert from "node:assert/strict";
import test from "node:test";
import { meetsPasswordPolicy } from "../src/password-policy.js";

test("admin password policy enforces length and character requirements", () => {
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
});
