import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";
import type { Prisma } from "../src/generated/prisma/client.js";

test("invoice archive and restore preserve the last edit timestamp", async (context) => {
  const updatedAt = new Date("2026-09-15T10:00:00Z");
  const archivedAt = new Date("2026-10-11T10:00:00Z");
  const writes: Prisma.InvoiceUpdateArgs[] = [];
  const transaction = {
    invoice: {
      findUniqueOrThrow: async () => ({ updatedAt }),
      update: async (args: Prisma.InvoiceUpdateArgs) => { writes.push(args); return args.data; },
    },
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
    data: { archivedAt, purgeAt: new Date(archivedAt.getTime() + 30 * 86400000), updatedAt },
  });
  assert.deepEqual(writes[1], {
    where: { id: "invoice-test", updatedAt },
    data: { archivedAt: null, purgeAt: null, updatedAt },
  });
});

test("order PDF and archive routes preserve edit dates and guard archived writes", async () => {
  const source = await readFile(new URL("../src/orders/admin-order-routes.ts", import.meta.url), "utf8");
  assert.match(source, /generateOrderPdf\(input, orderPdfEditDate\(order, latestActivity, lastEdit\)\)/u);
  assert.match(source, /where: \{ id: existing\.id, archivedAt: null \}, data:/u);
  assert.match(source, /data: \{ archivedAt: now, purgeAt, updatedAt: existing\.updatedAt \}/u);
  assert.match(source, /data: \{ archivedAt: null, purgeAt: null, updatedAt: existing\.updatedAt \}/u);
});