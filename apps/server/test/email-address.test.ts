import assert from "node:assert/strict";
import test from "node:test";
import { isValidEmailAddress } from "@vega/domain";

test("shared e-mail validator accepts normal addresses and rejects malformed input", () => {
  assert.equal(isValidEmailAddress("ada@example.test"), true);
  assert.equal(isValidEmailAddress("Test@Example.test"), true);
  assert.equal(isValidEmailAddress("vorname.nachname+tag@sub.example.test"), true);
  assert.equal(isValidEmailAddress(`${"a".repeat(241)}@example.test`), true);
  for (const invalid of [
    "",
    "nope",
    "not-an-email",
    "@example.test",
    "ada@",
    "ada@@example.test",
    "ada@example",
    "ada@example.",
    "ada@.example.test",
    "a b@example.test",
    "ada@exam ple.test",
    "ada@example.test ",
    " ada@example.test",
    "a\td@example.test",
    "a\nb@example.test",
    "x".repeat(250) + "@e.test",
    null,
    undefined,
    42,
    { email: "ada@example.test" },
  ]) {
    assert.equal(isValidEmailAddress(invalid), false, `must reject ${JSON.stringify(invalid)}`);
  }
});

test("shared e-mail validator stays linear on the reported ReDoS payload shape", () => {
  const payload = `!@!.${"!.".repeat(5000)}`;
  const started = Date.now();
  assert.equal(isValidEmailAddress(payload), false);
  assert.ok(Date.now() - started < 1000, "validation must not backtrack on adversarial input");
});
