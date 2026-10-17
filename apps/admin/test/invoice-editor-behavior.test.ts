import assert from "node:assert/strict";
import * as React from "react";
import test from "node:test";
import type { AdminCreditNoteDto, AdminInvoiceDto, AdminReminderDto } from "@vega/domain";
import { mount } from "./dom-test-helpers.js";
import { InvoiceEditorPage } from "../src/invoices/InvoiceEditorPage.js";

const invoice: AdminInvoiceDto = {
  id: "invoice-1", revision: 7, invoiceNumber: "R-42", orderNumber: null, invoiceDate: "2026-10-11",
  company: "", customerName: "Ada", customerStreet: "", customerPostalCity: "", taxPercent: 19,
  text: "Invoice text", entries: [], dueDates: [], archivedAt: null, createdAt: "2026-10-11T00:00:00Z", updatedAt: "2026-10-11T00:00:00Z",
};
const credit: AdminCreditNoteDto = {
  id: "credit-1", invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, creditNumber: "G-42",
  company: "", customerName: "Ada", customerStreet: "", customerPostalCity: "", taxPercent: 19,
  creditDate: "2026-10-11", text: "Credit text", entries: [], archivedAt: null, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt,
};
const reminders: AdminReminderDto[] = [1, 2].map((level) => ({
  id: `reminder-${level}`, invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber,
  level, previousDueDate: "2026-10-11", dueDate: "2026-10-21", fee: 10, outstandingAmount: 238,
  text: `Reminder ${level}`, sentAt: null, archivedAt: null, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt,
}));
const reply = (data: unknown) => Response.json({ data });

test("invoice PUT sends the loaded revision, preserves rejected drafts, and clears dirty only after success", async (context) => {
  let globalDirty = false;
  let invoiceDirty = false;
  let attempts = 0;
  const sent: Array<Record<string, unknown>> = [];
  context.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    if (init?.method === "PUT") {
      sent.push(JSON.parse(String(init.body)));
      attempts += 1;
      return attempts === 1
        ? Response.json({ error: { code: "INVOICE_CONFLICT", message: "Zwischenzeitlich geändert." } }, { status: 409 })
        : reply({ ...invoice, customerName: "Confirmed name", revision: 8 });
    }
    if (path.startsWith("/api/admin/reminders")) return reply({ items: [] });
    if (path.startsWith("/api/admin/credits")) return reply({ items: [] });
    return reply(invoice);
  });
  const dom = await mount(React.createElement(InvoiceEditorPage, {
    id: invoice.id, navigate: () => {},
    onDirtyChange: (dirty) => { globalDirty = dirty; },
    onInvoiceDirtyChange: (dirty) => { invoiceDirty = dirty; },
  }));
  context.after(() => dom.cleanup());
  await dom.flush();
  const customer = field(dom.container, "Kunde");
  await dom.input(customer, "Local draft");
  assert.equal(globalDirty, true);
  assert.equal(invoiceDirty, true);
  const form = dom.container.querySelector("form")!;
  await React.act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(sent[0]?.revision, 7);
  assert.equal(customer.value, "Local draft");
  assert.equal(globalDirty, true);
  assert.match(dom.container.textContent ?? "", /Zwischenzeitlich geändert/u);
  await React.act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(sent[1]?.revision, 7);
  assert.equal(customer.value, "Confirmed name");
  assert.equal(globalDirty, false);
  assert.equal(invoiceDirty, false);
  await dom.input(customer, "Next draft");
  await React.act(async () => { form.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true })); });
  assert.equal(sent[2]?.revision, 8);
});

test("accounting drafts survive tab switches and other saves while global document actions remain locked", async (context) => {
  let globalDirty = false;
  let invoiceDirty = true;
  let accountingDirty = false;
  const writes: string[] = [];
  context.mock.method(globalThis, "fetch", async (path: string, init?: RequestInit) => {
    if (init?.method === "PUT" && path.includes("reminder-1")) {
      writes.push(path);
      return reply({ ...reminders[0], ...JSON.parse(String(init.body)) });
    }
    if (init?.method === "PUT" && path.includes("credit-1")) {
      writes.push(path);
      return reply({ ...credit, ...JSON.parse(String(init.body)) });
    }
    if (path.startsWith("/api/admin/reminders")) return reply({ items: reminders });
    if (path.startsWith("/api/admin/credits")) return reply({ items: [credit] });
    return reply(invoice);
  });
  const dom = await mount(React.createElement(InvoiceEditorPage, {
    id: invoice.id, navigate: () => {}, onDirtyChange: (dirty) => { globalDirty = dirty; },
    onInvoiceDirtyChange: (dirty) => { invoiceDirty = dirty; },
    onAccountingDirtyChange: (dirty) => { accountingDirty = dirty; },
  }));
  context.after(() => dom.cleanup());
  await dom.flush();
  const first = textarea(dom.container, "Reminder 1");
  const second = textarea(dom.container, "Reminder 2");
  const creditText = textarea(dom.container, "Credit text");
  await dom.input(first, "First local draft");
  await dom.input(second, "Second local draft");
  await dom.click(tab(dom.container, "Gutschrift"));
  await dom.input(creditText, "Credit local draft");
  assert.equal(globalDirty, true);
  assert.equal(invoiceDirty, false);
  assert.equal(accountingDirty, true);
  for (const action of [...dom.container.querySelectorAll<HTMLButtonElement>("button")].filter((button) => ["Archivieren", "Löschen", "E-Mail"].includes(button.textContent ?? ""))) {
    assert.equal(action.disabled, true, action.textContent ?? "");
  }
  assert.ok([...dom.container.querySelectorAll("a")].every((link) => !link.hasAttribute("href")));
  await dom.click(tab(dom.container, "1. Mahnung"));
  assert.equal(first.value, "First local draft");
  await dom.click(saveButton(first));
  assert.deepEqual(writes, ["/api/admin/reminders/reminder-1"]);
  assert.equal(second.value, "Second local draft");
  assert.equal(creditText.value, "Credit local draft");
  assert.equal(globalDirty, true);
  assert.equal(saveButton(first).disabled, true);
  await dom.click(tab(dom.container, "Gutschrift"));
  await dom.click(saveButton(creditText));
  assert.equal(second.value, "Second local draft");
  assert.equal(globalDirty, true);
  await dom.click(tab(dom.container, "2. Mahnung"));
  assert.equal(second.value, "Second local draft");
});

test("new invoice creation clears the navigation dirty flag before navigating to the saved invoice", async (context) => {
  let dirty = false;
  let destination = "";
  context.mock.method(globalThis, "fetch", async (_path: string, init?: RequestInit) =>
    init?.method === "POST" ? reply({ ...invoice, revision: 0 }) : reply({ nextValue: 42 }));
  const dom = await mount(React.createElement(InvoiceEditorPage, {
    onDirtyChange: (value) => { dirty = value; },
    navigate: (path) => { assert.equal(dirty, false); destination = path; },
  }));
  context.after(() => dom.cleanup());
  await dom.flush();
  assert.equal(dirty, true);
  await dom.input(field(dom.container, "Kunde"), "Ada");
  await React.act(async () => {
    dom.container.querySelector("form")!.dispatchEvent(new dom.window.Event("submit", { bubbles: true, cancelable: true }));
  });
  assert.equal(destination, "/invoices/invoice-1");
});

test("an archived invoice editor redirects to its read-only archive", async (context) => {
  let destination = "";
  context.mock.method(globalThis, "fetch", async () => reply({ ...invoice, archivedAt: invoice.createdAt }));
  const dom = await mount(React.createElement(InvoiceEditorPage, { id: invoice.id, navigate: (path) => { destination = path; } }));
  context.after(() => dom.cleanup());
  await dom.flush();
  assert.equal(destination, "/invoices/archived");
});

for (const resource of ["credits", "reminders"] as const) {
  test(`failed ${resource} loading can be retried without blocking or discarding the invoice draft`, async (context) => {
    let attempts = 0;
    let busy = true;
    let dirty = false;
    let completeRetry: ((response: Response) => void) | undefined;
    context.mock.method(globalThis, "fetch", async (path: string) => {
      if (path.startsWith(`/api/admin/${resource}`)) {
        attempts++;
        if (attempts === 1) {
          if (resource === "credits") throw new TypeError("Failed to fetch");
          return Response.json({ error: { message: "Temporarily unavailable." } }, { status: 503 });
        }
        return new Promise<Response>((resolve) => { completeRetry = resolve; });
      }
      if (path.startsWith("/api/admin/reminders")) return reply({ items: reminders });
      if (path.startsWith("/api/admin/credits")) return reply({ items: [credit] });
      return reply(invoice);
    });
    const dom = await mount(React.createElement(InvoiceEditorPage, {
      id: invoice.id, navigate: () => {}, onBusyChange: (value) => { busy = value; },
      onDirtyChange: (value) => { dirty = value; },
    }));
    context.after(() => dom.cleanup());
    await dom.flush();
    assert.equal(busy, false, "a failed optional document read must not leave the invoice permanently busy");
    const customer = field(dom.container, "Kunde");
    assert.equal(customer.closest("fieldset")?.disabled, false);
    await dom.click(tab(dom.container, resource === "credits" ? "1. Mahnung" : "Gutschrift"));
    const otherDraft = textarea(dom.container, resource === "credits" ? "Reminder 1" : "Credit text");
    assert.equal(otherDraft.closest("fieldset")?.disabled, false);
    await dom.input(otherDraft, "Keep the other document draft");
    await dom.click(tab(dom.container, "Rechnung"));
    await dom.input(customer, "Keep this draft");
    assert.equal(dirty, true);
    if (resource === "credits") await dom.click(tab(dom.container, "Gutschrift"));
    const retry = [...dom.container.querySelectorAll("button")].find((button) => button.textContent === "Erneut versuchen");
    assert.ok(retry, "the failed read must have an explicit retry action");
    assert.equal(retry.disabled, false);
    await dom.click(retry);
    assert.equal(busy, true, "the retry must remain busy until its request finishes");
    const resolveRetry = completeRetry;
    assert.ok(resolveRetry);
    await React.act(async () => { resolveRetry(reply({ items: [] })); });
    await dom.flush();
    assert.equal(attempts, 2);
    assert.equal(busy, false);
    assert.equal(customer.value, "Keep this draft");
    assert.equal(otherDraft.value, "Keep the other document draft");
    assert.equal(dirty, true);
    if (resource === "credits") {
      assert.ok([...dom.container.querySelectorAll("button")].some((button) => button.textContent === "Gutschrift anlegen"));
    } else {
      assert.ok(tab(dom.container, "+ 1. Mahnung"));
    }
  });
}

function field(container: HTMLElement, label: string): HTMLInputElement {
  const node = [...container.querySelectorAll("label")].find((item) => item.textContent?.startsWith(label));
  assert.ok(node);
  const input = container.querySelector<HTMLInputElement>(`[id="${node.htmlFor}"]`);
  assert.ok(input);
  return input;
}
function textarea(container: HTMLElement, value: string): HTMLTextAreaElement {
  const node = [...container.querySelectorAll("textarea")].find((item) => item.value === value && !item.hasAttribute("aria-hidden"));
  assert.ok(node, value);
  return node;
}
function tab(container: HTMLElement, name: string): HTMLButtonElement {
  const node = [...container.querySelectorAll<HTMLButtonElement>('[role="tab"]')].find((item) => item.textContent === name);
  assert.ok(node, name);
  return node;
}
function saveButton(input: HTMLElement): HTMLButtonElement {
  const section = input.closest("section");
  assert.ok(section);
  const button = [...section.querySelectorAll("button")].find((item) => item.textContent === "Speichern");
  assert.ok(button);
  return button;
}
