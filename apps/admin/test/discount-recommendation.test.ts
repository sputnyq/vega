import assert from "node:assert/strict";
import test from "node:test";
import { suggestDiscountPercent } from "../src/orders/discount-recommendation.js";

const today = new Date(2026, 9, 17, 12);

function dateAfter(days: number): string {
  const date = new Date(
    today.getFullYear(),
    today.getMonth(),
    today.getDate() + days,
  );
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

test("discount recommendation is 5% from 30 days and 10% from 60 days ahead", () => {
  assert.equal(suggestDiscountPercent(dateAfter(29), today), null);
  assert.equal(suggestDiscountPercent(dateAfter(30), today), 5);
  assert.equal(suggestDiscountPercent(dateAfter(59), today), 5);
  assert.equal(suggestDiscountPercent(dateAfter(60), today), 10);
  assert.equal(suggestDiscountPercent(dateAfter(90), today), 10);
});

test("discount recommendation rejects past and malformed moving dates", () => {
  assert.equal(suggestDiscountPercent(dateAfter(-1), today), null);
  assert.equal(suggestDiscountPercent("", today), null);
  assert.equal(suggestDiscountPercent("2026-02-30", today), null);
});
