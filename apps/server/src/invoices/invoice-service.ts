import { randomUUID } from "node:crypto";
import { manualInvoiceNextValue, MAX_INVOICE_SEQUENCE_VALUE, type InvoiceInput } from "@vega/domain";
import { prisma } from "../prisma.js";
import { invoiceData } from "./invoice-input.js";

const RETENTION_DAYS = 30;

export async function createInvoice(input: InvoiceInput, order?: { id: string; orderNumber: number }) {
  return prisma.$transaction(async (tx) => {
    let invoiceNumber = input.invoiceNumber;
    if (invoiceNumber) {
      const nextValue = manualInvoiceNextValue(invoiceNumber);
      if (nextValue !== undefined) {
        if (!Number.isSafeInteger(nextValue) || nextValue > MAX_INVOICE_SEQUENCE_VALUE) {
          throw new RangeError("Rechnungsnummer überschreitet den unterstützten Nummernkreis.");
        }
        await tx.invoiceNumberSequence.updateMany({
          where: { id: 1, nextValue: { lt: nextValue } },
          data: { nextValue },
        });
      }
    } else {
      const sequence = await tx.invoiceNumberSequence.update({
        where: { id: 1 },
        data: { nextValue: { increment: 1 } },
        select: { nextValue: true },
      });
      invoiceNumber = `R-${sequence.nextValue - 1}`;
    }
    return tx.invoice.create({
      data: {
        id: randomUUID(),
        ...(order ? { orderId: order.id, orderNumberSnapshot: order.orderNumber } : {}),
        ...invoiceData(input, invoiceNumber),
      },
    });
  });
}

export function updateInvoice(id: string, input: InvoiceInput, invoiceNumber: string) {
  return prisma.invoice.update({
    where: { id },
    data: invoiceData(input, input.invoiceNumber ?? invoiceNumber),
  });
}

export function archiveInvoice(id: string, archivedAt: Date) {
  return prisma.invoice.update({
    where: { id },
    data: {
      archivedAt,
      purgeAt: new Date(archivedAt.getTime() + RETENTION_DAYS * 86400000),
    },
  });
}

export function restoreInvoice(id: string) {
  return prisma.invoice.update({
    where: { id },
    data: { archivedAt: null, purgeAt: null },
  });
}

export function recordInvoicePdfExport(orderId: string, actorName: string) {
  return prisma.orderActivityEvent.create({
    data: { id: randomUUID(), orderId, action: "PDF_EXPORTED", actorName },
  });
}
