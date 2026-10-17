import assert from "node:assert/strict";
import test from "node:test";
import { EmailSendAttempt } from "../src/email/email-send-attempt.js";

function storage() {
  const entries = new Map<string, string>();
  return { entries, getItem: (key: string) => entries.get(key) ?? null, setItem: (key: string, value: string) => { entries.set(key, value); }, removeItem: (key: string) => { entries.delete(key); } };
}

test("lost responses permit only payload-free status checks until explicit completion", () => {
  const store = storage();
  const attempt = new EmailSendAttempt("test-loss", store);
  const first = attempt.begin({ subject: "Original", contentHtml: "<p>private</p>" })!;
  assert.equal(attempt.begin({ subject: "Parallel" }), undefined);
  attempt.finish();
  assert.equal(attempt.frozen, true);
  assert.equal(attempt.begin({ subject: "Changed" }), undefined);
  assert.deepEqual(attempt.beginStatusCheck(), { idempotencyKey: first.idempotencyKey });
  attempt.finish({ status: "UNKNOWN", errorCode: "MAIL_TIMEOUT" });
  attempt.newMessage();
  assert.equal(attempt.begin({ subject: "Changed again" }), undefined);
  assert.deepEqual(attempt.beginStatusCheck(), { idempotencyKey: first.idempotencyKey });
  attempt.finish({ status: "SENT" });
  attempt.newMessage();
  const next = attempt.begin({ subject: "Explicit new mail" })!;
  assert.notEqual(next.idempotencyKey, first.idempotencyKey);
  assert.equal(next.subject, "Explicit new mail");
  assert.doesNotMatch([...store.entries.values()].join(""), /private|Original|Explicit new mail/u);
});

test("the same key survives remounts and uncertain payload edits cannot silently create another mail", () => {
  const store = storage();
  const first = new EmailSendAttempt("test-remount", store);
  const request = first.begin({ subject: "First" })!;
  first.finish({ status: "UNKNOWN", errorCode: "MAIL_TIMEOUT" });
  const reopened = new EmailSendAttempt("test-remount", store);
  assert.equal(reopened.status, "UNKNOWN");
  assert.equal(reopened.frozen, true);
  reopened.newMessage();
  assert.equal(reopened.begin({ subject: "Changed" }), undefined);
  const retry = reopened.beginStatusCheck()!;
  assert.equal(retry.idempotencyKey, request.idempotencyKey);
  assert.deepEqual(Object.keys(retry), ["idempotencyKey"]);
  assert.equal(reopened.rejectBeforeQueue("MAIL_NOT_CONFIGURED"), undefined);
  assert.equal(reopened.status, "UNKNOWN");
});

test("a reload with only key/state can unlock a fresh draft only after confirmed NOT_QUEUED", () => {
  const store = storage();
  const key = "reload-only-key-123456";
  store.setItem("test-reload", JSON.stringify({ key, status: "UNCONFIRMED" }));
  const reloaded = new EmailSendAttempt("test-reload", store);
  assert.equal(reloaded.begin({ subject: "Unexpected new draft" }), undefined);
  assert.deepEqual(reloaded.beginStatusCheck(), { idempotencyKey: key });
  reloaded.finish({ status: "NOT_QUEUED" });
  assert.equal(reloaded.frozen, false);
  assert.equal(reloaded.begin({ subject: "New draft" }), undefined);
  reloaded.newMessage();
  const explicit = reloaded.begin({ subject: "New draft" })!;
  assert.equal(explicit.subject, "New draft");
  assert.notEqual(explicit.idempotencyKey, key);
});
