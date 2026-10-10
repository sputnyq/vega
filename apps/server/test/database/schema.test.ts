import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import { readFile } from "node:fs/promises";
import type { Prisma } from "@prisma/client";
import type { InvoiceInput } from "@vega/domain";
import express from "express";
import test, { after } from "node:test";
import { orderFixture } from "../fixtures/order.js";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^\/[a-zA-Z0-9_]+_test$/u.test(new URL(testUrl).pathname)) {
  throw new Error("TEST_DATABASE_URL must explicitly select a separate database ending in _test.");
}
process.env.DATABASE_URL = testUrl;
const { prisma } = await import("../../src/prisma.js");
const { createOrder } = await import("../../src/orders/order-service.js");
const { createAdminOrderRouter } = await import("../../src/orders/admin-order-routes.js");
const { createInvoiceRouter } = await import("../../src/invoices/invoice-routes.js");
const { createInvoice: persistInvoice } = await import("../../src/invoices/invoice-service.js");
const { orderDataWithRelations, orderRelationCreates, orderRelations } = await import("../../src/orders/order-relations.js");
after(() => prisma.$disconnect());

async function rollback(operation: (transaction: Prisma.TransactionClient) => Promise<void>) {
  const sentinel = new Error("Rollback test fixtures");
  await assert.rejects(prisma.$transaction(async (transaction) => {
    await operation(transaction);
    throw sentinel;
  }, { timeout: 15_000 }), (error) => error === sentinel);
}
function uniqueFailure(error: unknown) {
  return typeof error === "object" && error !== null && "code" in error && error.code === "P2002";
}
function assertRecord(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
}
function stringValue(value: unknown): string {
  if (typeof value !== "string") throw new Error("Expected a string in the invoice response.");
  return value;
}
function arrayValue(value: unknown): unknown[] {
  if (!Array.isArray(value)) throw new Error("Expected an array in the invoice response.");
  return value;
}
async function responseData(response: Awaited<ReturnType<typeof fetch>>) {
  const body: unknown = await response.json();
  assertRecord(body);
  assertRecord(body.data);
  return body.data;
}
async function responseError(response: Awaited<ReturnType<typeof fetch>>) {
  const body: unknown = await response.json();
  assertRecord(body);
  assertRecord(body.error);
  return body.error;
}

test("fresh migrations initialize only technical sequences/settings, with the complete relational schema", async () => {
  assert.equal((await prisma.orderNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, 1000);
  assert.equal((await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, 1);
  const settings = await prisma.appSettings.findUniqueOrThrow({ where: { id: 1 } });
  for (const key of ["boxCbm", "kleiderboxCbm", "origin", "dataPrivacyUrl", "successUrl", "boxCalculatorUrl", "companyEmail", "emailFromName", "emailFromAddress"] as const) {
    assert.equal(settings[key], null);
  }
  const counts = await Promise.all([
    prisma.order.count(), prisma.orderAddress.count(), prisma.orderPosition.count(),
    prisma.creditNote.count(), prisma.reminderEvent.count(), prisma.catalogFurniture.count(),
  ]);
  assert.ok(counts.every((count) => count === 0));
});

test("database constraints enforce unique numbers, independent copies and independently retained financial records", async () => {
  await rollback(async (tx) => {
    const input = orderFixture();
    const baseOrder = { customerName: "Test Kunde", customerPhone: "089123456", source: "individuelle", data: JSON.parse(JSON.stringify(input)) };
    const origin = await tx.order.create({ data: { ...baseOrder, id: randomUUID(), orderNumber: 2000, ...orderRelationCreates(input) } });
    const repeatedAddress = orderRelationCreates(input).addresses.create[0];
    assert.ok(repeatedAddress);
    await assert.rejects(tx.orderAddress.create({ data: { ...repeatedAddress, orderId: origin.id } }), uniqueFailure);
    const copy = await tx.order.create({ data: { ...baseOrder, id: randomUUID(), orderNumber: 2001, originOrderId: origin.id, edited: true, ...orderRelationCreates(input) } });
    const sibling = await tx.order.create({ data: { ...baseOrder, id: randomUUID(), orderNumber: 2002, originOrderId: origin.id, edited: true, ...orderRelationCreates(input) } });
    await assert.rejects(tx.order.create({ data: { ...baseOrder, id: randomUUID(), orderNumber: 2000 } }), uniqueFailure);
    const invoiceData = {
      customerNameSnapshot: "Test Kunde", invoiceDate: new Date(), text: "", entries: [], dueDates: [],
    };
    const invoice = await tx.invoice.create({ data: { ...invoiceData, id: randomUUID(), invoiceNumber: "R-test-1", orderId: origin.id, orderNumberSnapshot: 2000 } });
    await assert.rejects(tx.invoice.create({ data: { ...invoiceData, id: randomUUID(), invoiceNumber: "R-test-2", orderId: origin.id } }), uniqueFailure);
    await assert.rejects(tx.invoice.create({ data: { ...invoiceData, id: randomUUID(), invoiceNumber: invoice.invoiceNumber } }), uniqueFailure);
    await tx.invoice.create({ data: { ...invoiceData, id: randomUUID(), invoiceNumber: "R-test-blank-1" } });
    await tx.invoice.create({ data: { ...invoiceData, id: randomUUID(), invoiceNumber: "R-test-blank-2" } });
    const creditData = {
      invoiceId: invoice.id, invoiceNumberSnapshot: invoice.invoiceNumber, orderNumberSnapshot: 2000,
      customerNameSnapshot: "Test Kunde", company: "", customerStreet: "Teststrasse 1", customerPostalCity: "80331 Muenchen",
      creditDate: new Date(), taxPercent: 19, text: "", entries: [],
    };
    const credit = await tx.creditNote.create({ data: { ...creditData, id: randomUUID(), creditNumber: "G-test-1" } });
    await assert.rejects(tx.creditNote.create({ data: { ...creditData, id: randomUUID(), creditNumber: "G-test-2" } }), uniqueFailure);
    await assert.rejects(tx.creditNote.create({ data: { ...creditData, invoiceId: null, id: randomUUID(), creditNumber: credit.creditNumber } }), uniqueFailure);
    const reminder = await tx.reminderEvent.create({ data: {
      id: randomUUID(), invoiceId: invoice.id, invoiceNumberSnapshot: invoice.invoiceNumber,
      orderNumberSnapshot: 2000, customerNameSnapshot: "Test Kunde", level: 1, dueDate: new Date(),
      outstandingAmount: 100, fee: 10, text: "Test", actorName: "Test Admin",
    } });
    const activity = await tx.orderActivityEvent.create({ data: { id: randomUUID(), orderId: origin.id, action: "CREATED_ADMIN", actorName: "Test Admin" } });
    const imageData = { tokenHash: "", objectKey: "test/final.jpg", size: 100, expiresAt: new Date(), verifiedAt: new Date(), generation: "1" };
    await tx.orderImage.create({ data: { ...imageData, id: randomUUID(), orderId: origin.id } });
    const copiedImage = await tx.orderImage.create({ data: { ...imageData, id: randomUUID(), orderId: copy.id } });
    const outbox = await tx.emailOutbox.create({ data: {
      id: randomUUID(), orderId: origin.id, kind: "INQUIRY_RECEIVED", recipients: ["customer@example.test"],
      subject: "Test", contentHtml: "<p>Test</p>", idempotencyKey: randomUUID(), nextAttemptAt: new Date(),
    } });
    const email = await tx.emailEvent.create({ data: { id: randomUUID(), orderId: origin.id, outboxId: outbox.id, kind: "INQUIRY_RECEIVED", sentAt: new Date() } });
    await tx.order.delete({ where: { id: origin.id } });
    assert.equal((await tx.order.findUniqueOrThrow({ where: { id: copy.id } })).originOrderId, null);
    assert.equal((await tx.order.findUniqueOrThrow({ where: { id: sibling.id } })).originOrderId, null);
    assert.equal((await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).orderId, null);
    assert.equal((await tx.invoice.findUniqueOrThrow({ where: { id: invoice.id } })).orderNumberSnapshot, 2000);
    assert.equal(await tx.orderAddress.count({ where: { orderId: origin.id } }), 0);
    assert.equal(await tx.orderPosition.count({ where: { orderId: origin.id } }), 0);
    assert.equal(await tx.orderActivityEvent.findUnique({ where: { id: activity.id } }), null);
    assert.equal(await tx.emailOutbox.findUnique({ where: { id: outbox.id } }), null);
    assert.equal(await tx.emailEvent.findUnique({ where: { id: email.id } }), null);
    assert.equal((await tx.orderImage.findUniqueOrThrow({ where: { id: copiedImage.id } })).objectKey, imageData.objectKey);
    await tx.order.delete({ where: { id: copy.id } });
    assert.equal(await tx.orderAddress.count({ where: { orderId: sibling.id } }), 4);
    await tx.invoice.delete({ where: { id: invoice.id } });
    const retainedCredit = await tx.creditNote.findUniqueOrThrow({ where: { id: credit.id } });
    const retainedReminder = await tx.reminderEvent.findUniqueOrThrow({ where: { id: reminder.id } });
    assert.equal(retainedCredit.invoiceId, null);
    assert.equal(retainedReminder.invoiceId, null);
    assert.equal(retainedCredit.invoiceNumberSnapshot, "R-test-1");
    assert.equal(retainedReminder.invoiceNumberSnapshot, "R-test-1");
    assert.equal(retainedReminder.sentAt, null);
    const archivedAt = new Date();
    const purgeAt = new Date(archivedAt.getTime() + 30 * 86400000);
    await tx.creditNote.update({ where: { id: credit.id }, data: { archivedAt, purgeAt } });
    assert.equal((await tx.reminderEvent.findUniqueOrThrow({ where: { id: reminder.id } })).archivedAt, null);
    await tx.creditNote.delete({ where: { id: credit.id } });
    assert.ok(await tx.reminderEvent.findUniqueOrThrow({ where: { id: reminder.id } }));
  });
});

test("additive migration backfills existing Vega address and position snapshots without changing the JSON draft", async () => {
  const migration = await readFile(new URL("../../../../prisma/migrations/20261009203000_complete_relational_foundation/migration.sql", import.meta.url), "utf8");
  const backfills = migration.match(/INSERT INTO `order(?:Address|Position)`[\s\S]*?;/gu) ?? [];
  assert.equal(backfills.length, 3);
  await rollback(async (tx) => {
    const fixture = orderFixture();
    assert.ok(fixture.details);
    fixture.details.furniture.items.push({ name: "Testmoebel", quantity: 2, catalogId: 123 });
    fixture.details.extras.services[0]!.catalogId = 234;
    const data = JSON.parse(JSON.stringify(fixture));
    const order = await tx.order.create({ data: {
      id: randomUUID(), orderNumber: 2500, customerName: "Test Kunde", customerPhone: "089123456", source: "individuelle", data,
    } });
    for (const statement of backfills) await tx.$executeRawUnsafe(statement);
    const migrated = await tx.order.findUniqueOrThrow({ where: { id: order.id }, include: orderRelations });
    assert.equal(migrated.addresses.length, 4);
    assert.equal(migrated.positions.length, 5);
    assert.deepEqual(migrated.data, data);
    assert.deepEqual(orderDataWithRelations(migrated), fixture);
  });
});

test("order create, copy, edit, read and invoice address projection use independent relational rows", async (context) => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.staffUser = { name: "Test Admin" }; next(); });
  app.use("/orders", createAdminOrderRouter());
  app.use("/invoices", createInvoiceRouter());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/orders`;
  const numbers: number[] = [];
  const invoiceIds: string[] = [];
  const orderSequence = await prisma.orderNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
  const invoiceSequence = await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
  context.after(async () => {
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.order.deleteMany({ where: { orderNumber: { in: numbers } } });
    await prisma.orderNumberSequence.update({ where: { id: 1 }, data: { nextValue: orderSequence.nextValue } });
    await prisma.invoiceNumberSequence.update({ where: { id: 1 }, data: { nextValue: invoiceSequence.nextValue } });
  });
  const fixture = orderFixture();
  const created = await createOrder(fixture, "admin", "Test Admin");
  numbers.push(created.orderNumber);
  const stored = await prisma.order.findUniqueOrThrow({ where: { orderNumber: created.orderNumber }, include: orderRelations });
  assert.equal(stored.edited, false);
  assert.equal(stored.addresses.length, 4);
  assert.equal(stored.positions.length, 4);
  assert.deepEqual(orderDataWithRelations(stored), fixture);
  const copiedResponse = await fetch(`${base}/${created.orderNumber}/copy`, { method: "POST" });
  assert.equal(copiedResponse.status, 201);
  const copiedData = await responseData(copiedResponse);
  const copiedNumber = copiedData.orderNumber;
  assert.ok(typeof copiedNumber === "number");
  numbers.push(copiedNumber);
  const copied = await prisma.order.findUniqueOrThrow({ where: { orderNumber: copiedNumber }, include: orderRelations });
  assert.equal(copied.edited, true);
  assert.deepEqual(orderDataWithRelations(copied), fixture);
  assert.ok(copied.addresses.every((row) => !stored.addresses.some((original) => original.id === row.id)));
  const edited = orderFixture();
  edited.from.street = "Neue Teststrasse 8";
  assert.ok(edited.details);
  edited.details.furniture.items = [{ name: "Anderes Testmoebel", quantity: 2 }];
  edited.details.extras.services = [];
  delete edited.details.secondaryFrom;
  edited.details.showSecondaryFrom = false;
  const update = await fetch(`${base}/${copiedNumber}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(edited) });
  assert.equal(update.status, 200);
  assert.deepEqual((await responseData(update)).data, edited);
  assert.deepEqual(orderDataWithRelations(await prisma.order.findUniqueOrThrow({ where: { id: stored.id }, include: orderRelations })), fixture);
  const updated = await prisma.order.findUniqueOrThrow({ where: { id: copied.id }, include: orderRelations });
  assert.equal(updated.addresses.length, 3);
  assert.equal(updated.positions.length, 1);
  await prisma.orderAddress.update({ where: { orderId_role: { orderId: copied.id, role: "FROM" } }, data: { street: "Relationale Teststrasse 9" } });
  const read = await fetch(`${base}/${copiedNumber}`);
  const readData = (await responseData(read)).data;
  assertRecord(readData);
  assertRecord(readData.from);
  assert.equal(readData.from.street, "Relationale Teststrasse 9");
  const list = await fetch(base);
  const listItems = (await responseData(list)).items;
  assert.ok(Array.isArray(listItems));
  const listedCopy: unknown = listItems.find((item) => item.orderNumber === copiedNumber);
  assertRecord(listedCopy);
  assert.ok(typeof listedCopy.fromAddress === "string");
  assert.ok(listedCopy.fromAddress.includes("Relationale Teststrasse 9"));
  await prisma.orderAddress.delete({ where: { orderId_role: { orderId: copied.id, role: "SECONDARY_TO" } } });
  const withoutSecondary = orderDataWithRelations(await prisma.order.findUniqueOrThrow({ where: { id: copied.id }, include: orderRelations }));
  assert.equal(withoutSecondary.details?.secondaryTo, undefined);
  await prisma.orderAddress.update({ where: { orderId_role: { orderId: copied.id, role: "TO" } }, data: { street: "Relationales Testziel 10" } });
  const invoiceResponse = await fetch(`http://127.0.0.1:${address.port}/invoices/from-order/${copiedNumber}`, { method: "POST" });
  assert.equal(invoiceResponse.status, 201);
  const invoice = await responseData(invoiceResponse);
  assert.ok(typeof invoice.id === "string");
  invoiceIds.push(invoice.id);
  assert.equal(invoice.customerStreet, "Relationales Testziel 10");
});

test("invoice HTTP lifecycle preserves envelopes, numbering, archive state, PDF headers, and export journal order", async (context) => {
  const app = express();
  app.use(express.json());
  app.use((_req, res, next) => { res.locals.staffUser = { name: "Test Admin" }; next(); });
  app.use("/invoices", createInvoiceRouter());
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}/invoices`;
  const sequenceBefore = await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
  const orderNumbers: number[] = [];
  const invoiceIds: string[] = [];
  context.after(async () => {
    await prisma.invoice.deleteMany({ where: { id: { in: invoiceIds } } });
    await prisma.order.deleteMany({ where: { orderNumber: { in: orderNumbers } } });
    await prisma.invoiceNumberSequence.update({ where: { id: 1 }, data: { nextValue: sequenceBefore.nextValue } });
  });

  const order = await createOrder(orderFixture(), "admin", "Test Admin");
  orderNumbers.push(order.orderNumber);
  const createdResponse = await fetch(`${base}/from-order/${order.orderNumber}`, { method: "POST" });
  assert.equal(createdResponse.status, 201);
  const created = await responseData(createdResponse);
  const createdInvoiceNumber = stringValue(created.invoiceNumber);
  const createdInvoiceDate = stringValue(created.invoiceDate);
  assert.equal(createdInvoiceNumber, `R-${sequenceBefore.nextValue}`);
  assert.equal(created.orderNumber, order.orderNumber);
  assert.equal((await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, sequenceBefore.nextValue + 1);
  assert.equal((await fetch(`${base}/from-order/${order.orderNumber}`, { method: "POST" })).status, 409);
  assert.equal((await fetch(`${base}/missing-invoice`)).status, 404);

  const invoiceId = stringValue(created.id);
  invoiceIds.push(invoiceId);
  const invoiceInput: InvoiceInput = {
    invoiceNumber: createdInvoiceNumber,
    invoiceDate: createdInvoiceDate,
    company: "Test GmbH",
    customerName: "Test Kunde",
    customerStreet: "Teststraße 1",
    customerPostalCity: "80331 München",
    taxPercent: 19,
    text: "Danke für Ihren Auftrag.",
    entries: [{ description: "Umzug", quantity: 2, unitPrice: 100 }],
    dueDates: [{ date: "2026-11-10", amount: 238, text: "Fällig" }],
  };
  const standaloneResponse = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...invoiceInput, invoiceNumber: undefined }),
  });
  assert.equal(standaloneResponse.status, 201);
  const standalone = await responseData(standaloneResponse);
  assert.equal(standalone.invoiceNumber, `R-${sequenceBefore.nextValue + 1}`);
  assert.equal(standalone.orderNumber, null);
  invoiceIds.push(stringValue(standalone.id));
  const manualNumber = `R-test-${randomUUID()}`;
  const manualResponse = await fetch(base, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...invoiceInput, invoiceNumber: manualNumber }),
  });
  assert.equal(manualResponse.status, 201);
  const manual = await responseData(manualResponse);
  assert.equal(manual.invoiceNumber, manualNumber);
  const manualId = stringValue(manual.id);
  invoiceIds.push(manualId);
  assert.equal((await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, sequenceBefore.nextValue + 3);
  const sequenceBeforeFailure = await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
  await assert.rejects(persistInvoice({ ...invoiceInput, invoiceNumber: manualNumber }), uniqueFailure);
  assert.equal((await prisma.invoiceNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, sequenceBeforeFailure.nextValue);

  const searchResponse = await fetch(`${base}?search=${encodeURIComponent(manualNumber)}`);
  const searchResult = await responseData(searchResponse);
  assert.deepEqual(arrayValue(searchResult.items).map((item) => {
    assertRecord(item);
    return stringValue(item.id);
  }), [manualId]);

  const conflictingUpdate = await fetch(`${base}/${invoiceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...invoiceInput, invoiceNumber: manualNumber }),
  });
  assert.equal(conflictingUpdate.status, 409);
  assert.deepEqual(await responseError(conflictingUpdate), {
    code: "INVOICE_NUMBER_IN_USE",
    message: "Diese Rechnungsnummer wird bereits verwendet.",
  });
  const updateResponse = await fetch(`${base}/${invoiceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(invoiceInput),
  });
  assert.equal(updateResponse.status, 200);
  const updated = await responseData(updateResponse);
  assert.equal(updated.id, invoiceId);
  assert.equal(updated.invoiceNumber, invoiceInput.invoiceNumber);
  assert.equal(updated.orderNumber, order.orderNumber);
  assert.equal(updated.customerName, invoiceInput.customerName);
  assert.equal(updated.customerStreet, invoiceInput.customerStreet);
  assert.equal(updated.taxPercent, invoiceInput.taxPercent);
  assert.equal(updated.text, invoiceInput.text);
  assert.deepEqual(updated.entries, invoiceInput.entries);
  assert.deepEqual(updated.dueDates, invoiceInput.dueDates);
  assert.equal(updated.archivedAt, null);

  const invalid = await fetch(`${base}/${invoiceId}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...invoiceInput, customerName: "" }),
  });
  assert.equal(invalid.status, 400);
  assert.deepEqual(await responseError(invalid), { code: "INVALID_INVOICE", message: "Rechnungsdatum und Kunde sind erforderlich." });

  const archiveResponse = await fetch(`${base}/${invoiceId}/archive`, { method: "POST" });
  assert.equal(archiveResponse.status, 200);
  const archived = await responseData(archiveResponse);
  assert.ok(typeof archived.archivedAt === "string");
  const archivedRecord = await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } });
  assert.equal(archivedRecord.purgeAt?.getTime(), archivedRecord.archivedAt!.getTime() + 30 * 86400000);
  const archivedList = await responseData(await fetch(`${base}?archived=true`));
  assert.ok(arrayValue(archivedList.items).some((item) => {
    assertRecord(item);
    return item.id === invoiceId;
  }));
  assert.equal((await fetch(`${base}/${invoiceId}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(invoiceInput) })).status, 409);

  const restoreResponse = await fetch(`${base}/${invoiceId}/restore`, { method: "POST" });
  assert.equal(restoreResponse.status, 200);
  assert.equal((await responseData(restoreResponse)).archivedAt, null);
  const pdfResponse = await fetch(`${base}/${invoiceId}/pdf`);
  assert.equal(pdfResponse.status, 200);
  assert.equal(pdfResponse.headers.get("cache-control"), "no-store");
  assert.match(pdfResponse.headers.get("content-type") ?? "", /application\/pdf/u);
  assert.match(pdfResponse.headers.get("content-disposition") ?? "", /filename\*=UTF-8''/u);
  assert.equal((await pdfResponse.arrayBuffer()).byteLength > 0, true);
  assert.equal(await prisma.orderActivityEvent.count({ where: { orderId: (await prisma.invoice.findUniqueOrThrow({ where: { id: invoiceId } })).orderId!, action: "PDF_EXPORTED" } }), 1);
});

test("failed order transactions consume no number and concurrent creation assigns unique consecutive numbers", async (context) => {
  const before = await prisma.orderNumberSequence.findUniqueOrThrow({ where: { id: 1 } });
  await assert.rejects(createOrder({
    ...orderFixture(), imageClaims: [{ id: randomUUID(), token: "x".repeat(43) }],
  }, "admin", "Test Admin"), (error: unknown) => {
    return typeof error === "object" && error !== null && "code" in error && error.code === "INVALID_UPLOAD_CLAIM";
  });
  assert.equal((await prisma.orderNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, before.nextValue);
  assert.equal(await prisma.order.count(), 0);
  assert.equal(await prisma.orderAddress.count(), 0);
  assert.equal(await prisma.orderPosition.count(), 0);
  const numbers: number[] = [];
  context.after(async () => {
    await prisma.order.deleteMany({ where: { orderNumber: { in: numbers } } });
    await prisma.orderNumberSequence.update({ where: { id: 1 }, data: { nextValue: before.nextValue } });
  });
  const results = await Promise.allSettled(Array.from({ length: 5 }, async () => {
    const created = await createOrder(orderFixture(), "admin", "Test Admin");
    numbers.push(created.orderNumber);
  }));
  assert.ok(results.every((result) => result.status === "fulfilled"));
  assert.deepEqual(numbers.sort((a, b) => a - b), Array.from({ length: 5 }, (_, index) => before.nextValue + index));
  assert.equal((await prisma.orderNumberSequence.findUniqueOrThrow({ where: { id: 1 } })).nextValue, before.nextValue + 5);
});
