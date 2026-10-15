import assert from "node:assert/strict";
import test from "node:test";
import {
  adminNotificationAutoHideDuration,
  adminNotificationReducer,
  initialAdminNotificationState,
} from "../src/components/admin-notification-queue.js";

test("success notifications expire after three seconds and errors stay open", () => {
  assert.equal(adminNotificationAutoHideDuration("success"), 3_000);
  assert.equal(adminNotificationAutoHideDuration("error"), null);
});

test("notifications are shown in order after the current one is dismissed", () => {
  const first = { id: 1, severity: "error" as const, message: "first" };
  const second = { id: 2, severity: "success" as const, message: "second" };
  const withFirst = adminNotificationReducer(initialAdminNotificationState, { type: "enqueue", notification: first });
  const withBoth = adminNotificationReducer(withFirst, { type: "enqueue", notification: second });

  assert.equal(withBoth.current, first);
  assert.deepEqual(withBoth.queued, [second]);
  assert.deepEqual(adminNotificationReducer(withBoth, { type: "dismiss" }), { current: second, queued: [] });
});