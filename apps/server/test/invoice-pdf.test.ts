import assert from "node:assert/strict";
import { Prisma, type Invoice } from "@prisma/client";
import test from "node:test";
import { calculateInvoiceTotals, generateInvoicePdf, invoicePdfFilename } from "../src/pdf/invoice-pdf.js";

function invoiceFixture(): Invoice {
  return {
    id: "invoice-42",
    invoiceNumber: "R-42",
    orderId: null,
    orderNumberSnapshot: null,
    customerNameSnapshot: "Ada Beispiel",
    company: "Beispiel GmbH",
    customerStreet: "Teststraße 1",
    customerPostalCity: "80331 München",
    invoiceDate: new Date("2026-10-09T00:00:00.000Z"),
    taxPercent: new Prisma.Decimal(19),
    text: "Vielen Dank.",
    entries: [{ description: "Umzug", quantity: 2, unitPrice: 100 }],
    dueDates: [],
    archivedAt: null,
    purgeAt: null,
    createdAt: new Date("2026-10-09T00:00:00.000Z"),
    updatedAt: new Date("2026-10-09T00:00:00.000Z"),
  };
}

test("invoice totals use all line items and the current tax rate", () => {
  assert.deepEqual(calculateInvoiceTotals([
    { description: "Umzug", quantity: 2, unitPrice: 100 },
    { description: "Kartons", quantity: 3, unitPrice: 10 },
  ], 19), { net: 230, tax: 43.7, total: 273.7 });
});

test("renders the legacy-styled invoice layout as a server-side PDF", async () => {
  const invoice = invoiceFixture();
  const pdf = await generateInvoicePdf(invoice);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.equal(pdf.subarray(-6).toString("ascii"), "%%EOF\n");
  assert.equal(invoicePdfFilename(invoice), "R-R-42 Beispiel GmbH.pdf");
});
