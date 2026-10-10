import assert from "node:assert/strict";
import test from "node:test";
import { MAIL_MAINTENANCE_DEFAULT_LIMIT, resolveMaintenanceLimit, runMailMaintenance } from "../src/mail/mail-maintenance.js";
import type { MailService } from "../src/mail/mail-service.js";

test("maintenance limit falls back to the default and is capped", () => {
  assert.equal(resolveMaintenanceLimit(undefined), MAIL_MAINTENANCE_DEFAULT_LIMIT);
  assert.equal(resolveMaintenanceLimit("10"), 10);
  assert.equal(resolveMaintenanceLimit("0"), MAIL_MAINTENANCE_DEFAULT_LIMIT);
  assert.equal(resolveMaintenanceLimit("nope"), MAIL_MAINTENANCE_DEFAULT_LIMIT);
  assert.equal(resolveMaintenanceLimit("10000"), 200);
});

test("mail maintenance delegates to the due-delivery run without touching mail content", async () => {
  const calls: Array<{ limit: number }> = [];
  const fakeService = {} as MailService;
  const result = await runMailMaintenance(fakeService, 10, async (_service, limit) => {
    calls.push({ limit });
    return { sent: 2, failed: 1 };
  });
  assert.deepEqual(result, { sent: 2, failed: 1 });
  assert.deepEqual(calls, [{ limit: 10 }]);
});
