import assert from "node:assert/strict";
import test from "node:test";
import { emailDefaults, passwordResetEmail, renderEmailLayout, sanitizeEmailHtml } from "../src/mail/email-template.js";
import { HostingerMailClient, MailDeliveryError } from "../src/mail/hostinger-mail-client.js";
import { MailService } from "../src/mail/mail-service.js";
import { EMPTY_SETTINGS } from "../src/settings/settings-input.js";

test("mail service keeps the established branded shell and derives plain text", async () => {
  const sent: unknown[] = [];
  const service = new MailService({ send: async (message) => { sent.push(message); } });
  const draft = emailDefaults.offer(1042);
  await service.send({ kind: "OFFER", to: [" Kunde@Example.test ", "kunde@example.test"], ...draft });

  assert.equal(sent.length, 1);
  const message = sent[0] as { to: string[]; html: string; text: string; subject: string };
  assert.deepEqual(message.to, ["kunde@example.test"]);
  assert.equal(message.subject, "📦 Umzugsangebot zu Ihrer Anfrage 1042");
  assert.match(message.html, /Logo-147\.svg/);
  assert.match(message.html, /Ihr Umzug Ruck Zuck Team/);
  assert.match(message.text, /Vielen Dank für Ihre Anfrage/);
});

test("password reset link is escaped in the retained email shell", () => {
  const draft = passwordResetEmail('https://vega.example/reset?token=a&next="bad"');
  const html = renderEmailLayout(draft.contentHtml);
  assert.match(html, /token=a&amp;next=&quot;bad&quot;/);
  assert.doesNotMatch(html, /next="bad"/);
  assert.ok(draft.text.includes('https://vega.example/reset?token=a&next="bad"'));
});

test("editable email content keeps basic formatting but removes executable and unsafe markup", () => {
  const html = sanitizeEmailHtml('<p onclick="alert(1)">Text <strong>fett</strong><script>alert(1)</script><a href="javascript:alert(1)">Link</a><a href="https://example.test">OK</a></p>');
  assert.equal(html, '<p>Text <strong>fett</strong>alert(1)<a>Link</a><a href="https://example.test">OK</a></p>');
});

test("Hostinger client uses the documented 204 send response and does not read its body", async () => {
  let request: Request | undefined;
  const client = new HostingerMailClient({
    apiToken: "test-token",
    mailboxResourceId: "mailbox/with slash",
    apiBaseUrl: new URL("https://mail.example.test"),
  }, async (input, init) => {
    request = new Request(input, init);
    return new Response(null, { status: 204 });
  });
  await client.send({ to: ["customer@example.test"], subject: "Test", html: "<p>Test</p>", text: "Test" });
  assert.equal(request?.url, "https://mail.example.test/api/v1/mailboxes/mailbox%2Fwith%20slash/send");
  assert.equal(request?.headers.get("authorization"), "Bearer test-token");
  assert.deepEqual(await request?.json(), { to: ["customer@example.test"], subject: "Test", html: "<p>Test</p>", text: "Test" });
});

test("Hostinger client classifies provider errors without retaining an error body", async () => {
  const client = new HostingerMailClient({ apiToken: "test-token", mailboxResourceId: "mailbox", apiBaseUrl: new URL("https://mail.example.test") }, async () => new Response(JSON.stringify({ error: { code: "ERR_INVALID_RECIPIENT" } }), { status: 422 }));
  await assert.rejects(() => client.send({ to: ["customer@example.test"], subject: "Test", html: "<p>Test</p>", text: "Test" }), (error: unknown) => error instanceof MailDeliveryError && error.code === "ERR_INVALID_RECIPIENT" && !error.retryable);
});

test("stored sender settings are used by all server mail flows", async () => {
  const sent: Array<{ displayName?: string; expectedFromAddress?: string }> = [];
  const service = new MailService({ send: async (message) => { sent.push(message); } },
    async () => ({ ...EMPTY_SETTINGS, emailFromName: "Testbetrieb", emailFromAddress: "sender@example.test" }));
  await service.send({ kind: "INQUIRY_RECEIVED", to: ["customer@example.test"], ...emailDefaults.inquiryReceived("Ada", 1042) });
  assert.equal(sent[0]?.displayName, "Testbetrieb");
  assert.equal(sent[0]?.expectedFromAddress, "sender@example.test");
});

test("configured sender address must match the actual Hostinger mailbox and is not sent as an unsupported from field", async () => {
  const calls: Request[] = [];
  const client = new HostingerMailClient({ apiToken: "test-token", mailboxResourceId: "mailbox", apiBaseUrl: new URL("https://mail.example.test") }, async (url, init) => {
    const request = new Request(url, init); calls.push(request);
    return request.url.endsWith("/me")
      ? Response.json({ data: { mailboxes: [{ resourceId: "mailbox", address: "sender@example.test" }] } })
      : new Response(null, { status: 204 });
  });
  const message = { to: ["customer@example.test"], subject: "Test", html: "<p>Test</p>", text: "Test", expectedFromAddress: "sender@example.test" };
  await client.send(message);
  assert.equal(calls.length, 2);
  const body = await calls[1]!.json();
  assert.equal("expectedFromAddress" in body, false);
  assert.equal("from" in body, false);
  await assert.rejects(client.send({ ...message, expectedFromAddress: "wrong@example.test" }),
    (error: unknown) => error instanceof MailDeliveryError && error.code === "MAIL_SENDER_ADDRESS_MISMATCH");
  assert.equal(calls.length, 3);
});
