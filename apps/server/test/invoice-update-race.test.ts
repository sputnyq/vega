import assert from "node:assert/strict";
import { once } from "node:events";
import express from "express";
import test from "node:test";
import { validateInvoice } from "../src/invoices/invoice-input.js";

const client = {
  order: {
    findUnique: async (_input: unknown): Promise<Record<string, unknown> | null> => null,
  },
  $transaction: async (_operation: unknown): Promise<unknown> => { throw new Error("Unexpected transaction"); },
  invoice: {
    findUnique: async (_input: unknown): Promise<Record<string, unknown> | null> => null,
    update: async (_input: unknown): Promise<never> => { throw new Error("Unexpected update"); },
  },
};
const previous = Reflect.get(globalThis, "vegaPrisma");
Reflect.set(globalThis, "vegaPrisma", client);
const { createInvoiceRouter } = await import("../src/invoices/invoice-routes.js");
const { createInvoice } = await import("../src/invoices/invoice-service.js");
if (previous === undefined) Reflect.deleteProperty(globalThis, "vegaPrisma");
else Reflect.set(globalThis, "vegaPrisma", previous);

const invoiceInput = { invoiceDate: "2026-10-11", company: "", customerName: "Test", customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [] };

for (const scenario of ["draft", "creation", "concurrent-archive"] as const) {
  test(`invoice from order rejects ${scenario} for an archived order`, async (context) => {
    const archivedAt = new Date("2026-10-11T10:00:00Z");
    context.mock.method(client.order, "findUnique", async () => ({ id: "order-test", orderNumber: 1001, archivedAt: scenario === "concurrent-archive" ? null : archivedAt }));
    let invoiceReads = 0;
    context.mock.method(client.invoice, "findUnique", async () => { invoiceReads += 1; return null; });
    let locks = 0;
    context.mock.method(client, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation({
      $queryRaw: async (strings: TemplateStringsArray, ...values: unknown[]) => {
        locks += 1;
        assert.match(strings.join("?"), /FOR UPDATE/u);
        assert.deepEqual(values, ["order-test", 1001]);
        return [{ archivedAt }];
      },
      invoiceNumberSequence: {
        update: async () => { assert.fail("Archived order must not consume a number"); },
        updateMany: async () => { assert.fail("Archived order must not advance the sequence"); },
      },
      invoice: { create: async () => { assert.fail("Archived order must not create an invoice"); } },
    }));
    const app = express();
    app.use(express.json());
    app.use("/invoices", createInvoiceRouter());
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/invoices/from-order/1001`, scenario === "draft" ? {} : {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invoiceInput),
    });
    assert.equal(response.status, 409);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, "ORDER_ARCHIVED");
    assert.equal(locks, scenario === "concurrent-archive" ? 1 : 0);
    assert.equal(invoiceReads, scenario === "concurrent-archive" ? 1 : 0);
  });
}

test("invoice creation locks active orders before allocating numbers and preserves standalone creation", async (context) => {
  const calls: string[] = [];
  context.mock.method(client, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation({
    $queryRaw: async () => { calls.push("lock"); return [{ archivedAt: null }]; },
    invoiceNumberSequence: { update: async () => { calls.push("number"); return { nextValue: 43 }; } },
    invoice: { create: async () => { calls.push("create"); return { id: "invoice-test" }; } },
  }));
  await createInvoice(invoiceInput, { id: "order-test", orderNumber: 1001 });
  assert.deepEqual(calls, ["lock", "number", "create"]);
  calls.length = 0;
  await createInvoice(invoiceInput);
  assert.deepEqual(calls, ["number", "create"]);
});

test("invoice writes only accept 19 or zero percent tax", () => {
  for (const taxPercent of [19, 0]) assert.equal(validateInvoice({ ...invoiceInput, taxPercent }).ok, true);
  for (const taxPercent of [7, 5.5, 100, -1, "19", null]) {
    assert.deepEqual(validateInvoice({ ...invoiceInput, taxPercent }), { ok: false, message: "Umsatzsteuer muss 19 % oder 0 % sein." });
  }
});

for (const scenario of ["archived", "deleted", "restored"] as const) {
  test(`invoice save handles concurrent ${scenario} state without HTTP 500`, async (context) => {
    let reads = 0;
    context.mock.method(client.invoice, "findUnique", async () => {
      reads += 1;
      if (reads === 1) return { id: "invoice-test", invoiceNumber: "R-42", archivedAt: null };
      if (scenario === "deleted") return null;
      return { archivedAt: scenario === "archived" ? new Date("2026-10-11T10:00:00Z") : null };
    });
    context.mock.method(client, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation({
      invoice: {
        updateMany: async (input: { where: unknown; data: { revision: unknown } }) => {
          assert.deepEqual(input.where, { id: "invoice-test", archivedAt: null, revision: 4 });
          assert.deepEqual(input.data.revision, { increment: 1 });
          return { count: 0 };
        },
      },
    }));
    const app = express();
    app.use(express.json());
    app.use("/invoices", createInvoiceRouter());
    const server = app.listen(0, "127.0.0.1");
    await once(server, "listening");
    context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
    const address = server.address();
    assert.ok(address && typeof address !== "string");
    const response = await fetch(`http://127.0.0.1:${address.port}/invoices/invoice-test`, {
      method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...invoiceInput, revision: 4 }),
    });
    assert.equal(response.status, scenario === "deleted" ? 404 : 409);
    const body = await response.json() as { error: { code: string } };
    assert.equal(body.error.code, scenario === "archived" ? "INVOICE_ARCHIVED" : scenario === "deleted" ? "INVOICE_NOT_FOUND" : "INVOICE_CONFLICT");
    assert.equal(reads, 2);
  });
}

test("invoice PUT requires a bounded numeric revision and rejects raw JSON overflow", async (context) => {
  let reads = 0;
  context.mock.method(client.invoice, "findUnique", async () => { reads += 1; return null; });
  const base = await listen(context);
  for (const revision of [undefined, null, "0", -1, 0.1, 2_147_483_647, 1e100]) {
    const response = await fetch(`${base}/invoice-test`, {
      method: "PUT", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ ...invoiceInput, revision }),
    });
    assert.equal(response.status, 400, String(revision));
  }
  const response = await fetch(base, {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...invoiceInput, entries: [{ description: "x", quantity: 1, unitPrice: "overflow" }] }).replace('"overflow"', "1e400"),
  });
  assert.equal(response.status, 400);
  assert.equal(reads, 0);
});

test("two stale invoice drafts cannot overwrite each other and successful saves return the new revision", async (context) => {
  const now = new Date("2026-10-11T10:00:00Z");
  let stored = {
    id: "invoice-test", ...invoiceInput, invoiceDate: now, invoiceNumber: "R-42",
    customerNameSnapshot: "Test", orderNumberSnapshot: null, archivedAt: null, revision: 0, createdAt: now, updatedAt: now,
  };
  context.mock.method(client.invoice, "findUnique", async () => ({ ...stored }));
  context.mock.method(client, "$transaction", async (operation: (tx: unknown) => Promise<unknown>) => operation({
    invoice: {
      updateMany: async ({ where, data }: { where: { revision: number }; data: { text: string; revision: { increment: number } } }) => {
        if (where.revision !== stored.revision) return { count: 0 };
        stored = { ...stored, text: data.text, revision: stored.revision + data.revision.increment };
        return { count: 1 };
      },
      findUniqueOrThrow: async () => ({ ...stored }),
    },
  }));
  const base = await listen(context);
  const save = (text: string, revision: number) => fetch(`${base}/invoice-test`, {
    method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...invoiceInput, text, revision }),
  });
  const first = await save("First draft", 0);
  assert.equal(first.status, 200);
  assert.equal((await first.json() as { data: { revision: number } }).data.revision, 1);
  const stale = await save("Stale draft", 0);
  assert.equal(stale.status, 409);
  assert.equal((await stale.json() as { error: { code: string } }).error.code, "INVOICE_CONFLICT");
  assert.equal(stored.text, "First draft");
  assert.equal((await save("Refreshed draft", 1)).status, 200);
  assert.equal(stored.revision, 2);
});

async function listen(context: test.TestContext) {
  const app = express();
  app.use(express.json());
  app.use("/invoices", createInvoiceRouter());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return `http://127.0.0.1:${address.port}/invoices`;
}