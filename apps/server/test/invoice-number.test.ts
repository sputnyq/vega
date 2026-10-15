import assert from "node:assert/strict";
import { once } from "node:events";
import test, { type TestContext } from "node:test";
import express from "express";
import { manualInvoiceNextValue, MAX_INVOICE_SEQUENCE_VALUE, type InvoiceInput } from "@vega/domain";
import type { Prisma } from "../src/generated/prisma/client.js";
import { prisma } from "../src/prisma.js";
import { createInvoice, updateInvoice } from "../src/invoices/invoice-service.js";
import { validateInvoice } from "../src/invoices/invoice-input.js";
import { createInvoiceRouter } from "../src/invoices/invoice-routes.js";

const input: InvoiceInput = {
  invoiceDate: "2026-10-10", company: "", customerName: "Test Kunde",
  customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [],
};

function mockMethod<T extends (...args: never[]) => unknown>(context: TestContext, target: object, name: string, implementation: T) {
  const original = Reflect.get(target, name);
  const mocked = context.mock.fn(implementation);
  Reflect.set(target, name, mocked);
  context.after(() => { Reflect.set(target, name, original); });
  return mocked;
}

test("only positive integer R-numbers advance the sequence, including leading zeros", () => {
  assert.equal(manualInvoiceNextValue("R-1"), 2);
  assert.equal(manualInvoiceNextValue("R-0042"), 43);
  assert.equal(manualInvoiceNextValue("R-2147483646"), MAX_INVOICE_SEQUENCE_VALUE);
  for (const number of [undefined, "", "R-0", "R-000", "R--1", "R-1.5", "R-1e3", "R-+3", "r-20", "R-42x", "2026/42"]) {
    assert.equal(manualInvoiceNextValue(number), undefined, number);
  }
});

test("creation rejects sequence overflow while edit validation remains unchanged", () => {
  assert.equal(validateInvoice({ ...input, invoiceNumber: " R-0042 " }, true).ok, true);
  assert.equal(validateInvoice({ ...input, invoiceNumber: "R-2147483646" }, true).ok, true);
  for (const invoiceNumber of ["R-2147483647", "R-9007199254740991", `R-${"9".repeat(62)}`]) {
    assert.equal(validateInvoice({ ...input, invoiceNumber }, true).ok, false);
    assert.equal(validateInvoice({ ...input, invoiceNumber }).ok, true);
  }
});

test("manual creation advances atomically only upwards and automatic creation uses the next value", async (context) => {
  let nextValue = 10;
  mockMethod(context, prisma, "$transaction", async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => operation(prisma));
  const advance = mockMethod(context, prisma.invoiceNumberSequence, "updateMany", async (args: { where: { id: number; nextValue: { lt: number } }; data: { nextValue: number } }) => {
    assert.equal(args.where.id, 1);
    assert.equal(args.where.nextValue.lt, args.data.nextValue);
    const count = nextValue < args.where.nextValue.lt ? 1 : 0;
    if (count) nextValue = args.data.nextValue;
    return { count };
  });
  const allocate = mockMethod(context, prisma.invoiceNumberSequence, "update", async (args: { data: { nextValue: { increment: number } } }) => {
    assert.equal(args.data.nextValue.increment, 1);
    nextValue += 1;
    return { nextValue };
  });
  mockMethod(context, prisma.invoice, "create", async (args: { data: Prisma.InvoiceUncheckedCreateInput }) => args.data);
  for (const invoiceNumber of ["R-4", "R-9", "R-0042", "custom", "R-0"]) {
    assert.equal((await createInvoice({ ...input, invoiceNumber })).invoiceNumber, invoiceNumber);
    assert.equal(nextValue, invoiceNumber === "R-4" || invoiceNumber === "R-9" ? 10 : 43);
  }
  assert.equal(allocate.mock.callCount(), 0);
  assert.equal(advance.mock.callCount(), 3);
  assert.equal((await createInvoice(input)).invoiceNumber, "R-43");
  assert.equal(nextValue, 44);
  await assert.rejects(createInvoice({ ...input, invoiceNumber: "R-2147483647" }), RangeError);
  assert.equal(nextValue, 44);
});

test("editing a manual number never touches the sequence and blank editing keeps the stored number", async (context) => {
  const advance = mockMethod(context, prisma.invoiceNumberSequence, "updateMany", () => { throw new Error("Unexpected sequence update"); });
  const allocate = mockMethod(context, prisma.invoiceNumberSequence, "update", () => { throw new Error("Unexpected sequence allocation"); });
  mockMethod(context, prisma.invoice, "update", async (args: { data: Prisma.InvoiceUncheckedUpdateInput }) => args.data);
  assert.equal((await updateInvoice("invoice", { ...input, invoiceNumber: "R-9000" }, "R-1")).invoiceNumber, "R-9000");
  assert.equal((await updateInvoice("invoice", input, "R-1")).invoiceNumber, "R-1");
  assert.equal(advance.mock.callCount(), 0);
  assert.equal(allocate.mock.callCount(), 0);
});

test("number preview is a read-only no-store envelope and creation errors remain explicit", async (context) => {
  const read = mockMethod(context, prisma.invoiceNumberSequence, "findUniqueOrThrow", async () => ({ nextValue: 42 }));
  const allocate = mockMethod(context, prisma.invoiceNumberSequence, "update", () => { throw new Error("Preview must not allocate"); });
  const transaction = mockMethod(context, prisma, "$transaction", async () => { throw Object.assign(new Error("Duplicate"), { code: "P2002" }); });
  const app = express();
  app.use(express.json());
  app.use("/invoices", createInvoiceRouter());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/invoices`;
  const response = await fetch(`${base}/next-number`);
  assert.equal(response.status, 200);
  assert.equal(response.headers.get("cache-control"), "no-store");
  assert.deepEqual(await response.json(), { data: { nextValue: 42 } });
  assert.deepEqual(read.mock.calls[0]?.arguments, [{ where: { id: 1 }, select: { nextValue: true } }]);
  assert.equal(allocate.mock.callCount(), 0);
  const invalid = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, invoiceNumber: "R-2147483647" }) });
  assert.equal(invalid.status, 400);
  assert.equal(transaction.mock.callCount(), 0);
  const duplicate = await fetch(base, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...input, invoiceNumber: "R-42" }) });
  assert.equal(duplicate.status, 409);
  assert.deepEqual(await duplicate.json(), { error: { code: "INVOICE_NUMBER_IN_USE", message: "Diese Rechnungsnummer wird bereits verwendet." } });
});
