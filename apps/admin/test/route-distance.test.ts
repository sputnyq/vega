import assert from "node:assert/strict";
import test from "node:test";
import { formatDurationMinutes } from "../src/orders/RouteDistance.js";

test("route durations use German minute and hour labels", () => {
  assert.equal(formatDurationMinutes(0), "0 Min.");
  assert.equal(formatDurationMinutes(5), "5 Min.");
  assert.equal(formatDurationMinutes(59), "59 Min.");
  assert.equal(formatDurationMinutes(60), "1 Std.");
  assert.equal(formatDurationMinutes(61), "1 Std. 1 Min.");
  assert.equal(formatDurationMinutes(125), "2 Std. 5 Min.");
  assert.equal(formatDurationMinutes(120), "2 Std.");
  assert.equal(formatDurationMinutes(4.6), "5 Min.");
  assert.equal(formatDurationMinutes(NaN), "–");
  assert.equal(formatDurationMinutes(-1), "–");
});
