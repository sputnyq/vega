import assert from "node:assert/strict";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client.js";

test("invoice archive and restore preserve the last edit timestamp", async (context) => {
  const updatedAt = new Date("2026-09-15T10:00:00Z");
  const archivedAt = new Date("2026-10-11T10:00:00Z");
  const writes: Prisma.InvoiceUpdateArgs[] = [];
  const reminderWrites: Prisma.ReminderEventUpdateManyArgs[] = [];
  const transaction = {
    invoice: {
      findUniqueOrThrow: async () => ({ updatedAt }),
      update: async (args: Prisma.InvoiceUpdateArgs) => { writes.push(args); return args.data; },
    },
    reminderEvent: { updateMany: async (args: Prisma.ReminderEventUpdateManyArgs) => { reminderWrites.push(args); return { count: 0 }; } },
  } as unknown as Prisma.TransactionClient;
  const previous = Reflect.get(globalThis, "vegaPrisma");
  Reflect.set(globalThis, "vegaPrisma", {
    $transaction: async (operation: (tx: Prisma.TransactionClient) => Promise<unknown>) => operation(transaction),
  });
  context.after(() => {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "vegaPrisma");
    else Reflect.set(globalThis, "vegaPrisma", previous);
  });
  const { archiveInvoice, restoreInvoice } = await import("../src/invoices/invoice-service.js");
  await archiveInvoice("invoice-test", archivedAt);
  await restoreInvoice("invoice-test");
  assert.deepEqual(writes[0], {
    where: { id: "invoice-test", updatedAt },
    data: { archivedAt, purgeAt: new Date(archivedAt.getTime() + 30 * 86400000), updatedAt, revision: { increment: 1 } },
  });
  assert.deepEqual(writes[1], {
    where: { id: "invoice-test", updatedAt },
    data: { archivedAt: null, purgeAt: null, updatedAt, revision: { increment: 1 } },
  });
  assert.deepEqual(reminderWrites, [
    { where: { invoiceId: "invoice-test", archivedAt: null }, data: { archivedAt, purgeAt: new Date(archivedAt.getTime() + 30 * 86400000) } },
    { where: { invoiceId: "invoice-test", archivedAt: { not: null } }, data: { archivedAt: null, purgeAt: null } },
  ]);
});
