import assert from "node:assert/strict";
import test from "node:test";
import { renderEmailLayout, sanitizeEmailHtml } from "../src/mail/email-template.js";
import { declineEmail, invoiceEmail, offerEmail, offerValidUntil, salutationLine } from "../src/mail/staff-email-templates.js";
import { validateStaffEmailInput } from "../src/mail/staff-email-service.js";
import { validateSignatureName } from "../src/staff/signature-name.js";
import { orderFixture } from "./fixtures/order.js";

const now = new Date("2026-10-15T22:30:00Z");

test("salutation follows the stored customer and stays neutral without a name", () => {
  assert.equal(salutationLine({ salutation: "Frau", firstName: "Eva", lastName: "Muster" }), "Sehr geehrte Frau Muster,");
  assert.equal(salutationLine({ salutation: "Herr", firstName: "Max", lastName: "Muster" }), "Sehr geehrter Herr Muster,");
  assert.equal(salutationLine({ firstName: "Kim", lastName: "Muster" }), "Hallo Kim Muster,");
  assert.equal(salutationLine({ firstName: " ", lastName: "" }), "Sehr geehrte Damen und Herren,");
  assert.equal(salutationLine(undefined), "Sehr geehrte Damen und Herren,");
});

test("offer validity is the next calendar day in Europe/Berlin", () => {
  assert.equal(offerValidUntil(now), "17.10.2026");
});

test("single offer lists crew, conditions and the PDF total without a closing greeting", () => {
  const data = orderFixture();
  assert.ok(data.details);
  data.details.conditions = [{ description: "Umzug <Pauschal>", amount: 500 }, { description: "Halteverbot", amount: 80 }];
  const draft = offerEmail({ option: { orderNumber: 1042, data }, referenceNumber: 1042, now });
  assert.equal(draft.subject, "📦 Umzugsangebot zu Ihrer Anfrage 1042");
  assert.match(draft.contentHtml, /<strong>1042<\/strong>/u);
  assert.match(draft.contentHtml, /Hallo Test Kunde,/u);
  assert.match(draft.contentHtml, /2 Mann mit 1 x LKW/u);
  assert.match(draft.contentHtml, /Maximale Abnahme: 4 Stunden/u);
  assert.match(draft.contentHtml, /Umzug &lt;Pauschal&gt;/u);
  assert.match(draft.contentHtml, /580,00\s€/u);
  assert.match(draft.contentHtml, /Im Anhang finden Sie den Auftrag\./u);
  assert.doesNotMatch(draft.contentHtml, /Option|Freundliche Grüße/u);
  // The draft must survive the server sanitizer unchanged so staff see what is sent.
  assert.equal(sanitizeEmailHtml(draft.contentHtml).replaceAll("<br />", "<br>"), draft.contentHtml);
});

test("two-option offer uses the family root reference and shows both options", () => {
  const first = orderFixture();
  const second = orderFixture();
  assert.ok(second.details);
  second.details.basis.workers = 3;
  const draft = offerEmail({ option: { orderNumber: 1043, data: first }, secondOption: { orderNumber: 1044, data: second }, referenceNumber: 1042, now });
  assert.equal(draft.subject, "📦 Umzugsangebot zu Ihrer Anfrage 1042");
  assert.match(draft.contentHtml, /<h2>1\. Option<\/h2>.*2 Mann.*<h2>2\. Option<\/h2>.*3 Mann/su);
  assert.match(draft.contentHtml, /beide Aufträge/u);
});

test("decline and invoice drafts escape names and fall back to the invoice snapshot", () => {
  const decline = declineEmail(1042, { salutation: "Herr", firstName: "A", lastName: "<B>" });
  assert.equal(decline.subject, "Ihre Umzugsanfrage 1042");
  assert.match(decline.contentHtml, /Herr &lt;B&gt;/u);
  assert.equal(invoiceEmail("2026-7", undefined, "Firma & Co").subject, "Rechnung zu Ihrem Umzug 2026-7");
  assert.match(invoiceEmail("2026-7", undefined, "Firma & Co").contentHtml, /Hallo Firma &amp; Co,/u);
  assert.match(invoiceEmail("2026-7", undefined, "").contentHtml, /Damen und Herren/u);
});

test("sanitizer keeps editor tables but strips styles, scripts and unsafe links", () => {
  const html = sanitizeEmailHtml('<table style="width:1px"><colgroup><col style="x"></colgroup><tbody><tr><th colspan="2" rowspan="1" onclick="x">A</th></tr><tr><td colspan="1">B</td></tr></tbody></table><script>alert(1)</script><a href="javascript:alert(1)">x</a><a href="https://example.test" target="_blank">y</a>');
  assert.equal(html, '<table><colgroup><col /></colgroup><tbody><tr><th colspan="2" rowspan="1">A</th></tr><tr><td colspan="1">B</td></tr></tbody></table><a>x</a><a href="https://example.test">y</a>');
  assert.match(renderEmailLayout(html), /Freundliche Grüße/u);
});

test("staff mail input is normalized and rejects header injection, empty text and weak keys", () => {
  const valid = validateStaffEmailInput({ to: " Kunde@Example.test ", subject: " Betreff ", contentHtml: "<p>Text</p><script>x</script>", idempotencyKey: "0f2b6a0e-6c55-4d6c-9b43-1b2f3a4c5d6e" });
  assert.deepEqual(valid, { ok: true, value: { to: "kunde@example.test", subject: "Betreff", contentHtml: "<p>Text</p>", idempotencyKey: "0f2b6a0e-6c55-4d6c-9b43-1b2f3a4c5d6e" } });
  const invalid = validateStaffEmailInput({ to: "a@b", subject: "x\r\nBcc: y", contentHtml: "<script>x</script>", idempotencyKey: "short" });
  assert.equal(invalid.ok, false);
  assert.deepEqual(!invalid.ok && invalid.issues.map((issue) => issue.field), ["to", "subject", "contentHtml", "idempotencyKey"]);
  assert.equal(validateStaffEmailInput({ to: "kunde@example.test", subject: "S", contentHtml: `<p>${"x".repeat(200_001)}</p>`, idempotencyKey: "0f2b6a0e-6c55-4d6c-9b43-1b2f3a4c5d6e" }).ok, false);
});

test("signature name is escaped into the greeting block and absent when unset", () => {
  assert.match(renderEmailLayout("<p>x</p>"), /Freundliche Grüße, <br \/>Ihr Umzug Ruck Zuck Team\./u);
  const html = renderEmailLayout("<p>Preis $& $'</p>", "Max <b>Meier</b>");
  assert.match(html, /Freundliche Grüße, <br \/>Max &lt;b&gt;Meier&lt;\/b&gt;<br \/>Ihr Umzug Ruck Zuck Team\./u);
  assert.match(html, /<p>Preis \$&amp; \$'<\/p>/u);
  assert.doesNotMatch(html, /\{\{(content|signature)\}\}/u);
});

test("signature name input is trimmed, may be cleared and rejects invalid values", () => {
  assert.deepEqual(validateSignatureName("  Max   Meier "), { ok: true, value: "Max Meier" });
  assert.deepEqual(validateSignatureName(""), { ok: true, value: null });
  assert.deepEqual(validateSignatureName(null), { ok: true, value: null });
  assert.equal(validateSignatureName(42).ok, false);
  assert.equal(validateSignatureName("x".repeat(101)).ok, false);
  assert.equal(validateSignatureName("Name\u0000").ok, false);
});
