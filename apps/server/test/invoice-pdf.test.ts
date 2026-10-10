import assert from "node:assert/strict";
import { Prisma, type Invoice } from "../src/generated/prisma/client.js";
import test from "node:test";
import PDFDocument from "pdfkit";
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

test("postal sender and recipient start below the logo with the legacy header spacing", async (context) => {
  const calls: Array<{ text: string; y: number }> = [];
  const original = PDFDocument.prototype.text;
  context.mock.method(PDFDocument.prototype, "text", function (this: PDFKit.PDFDocument, text: string, x: number, y: number, options?: PDFKit.Mixins.TextOptions) {
    calls.push({ text, y });
    return original.call(this, text, x, y, options);
  });
  await generateInvoicePdf(invoiceFixture());
  const postalY = (8 + 5 + 15) / 0.353 + 5 * 12 + 3 * 6;
  const position = (text: string) => {
    const call = calls.find((entry) => entry.text === text);
    assert.ok(call, text);
    return call.y;
  };
  assert.equal(position("Alexander Berent, Am Münchfeld 31, 80999 München"), postalY + 9.2 - 5.744);
  assert.ok(postalY > 22.7 + 102);
  const customerY = postalY + 18.4 + 5 / 0.353 + 14 + 5 / 0.353;
  assert.ok(Math.abs(position("Beispiel GmbH") - (customerY + 7 - 7.18)) < 0.001);
  assert.ok(Math.abs(position("Ada Beispiel") - (customerY + 14 + 7 - 7.18)) < 0.001);
  assert.equal(position("Alexander Berent"), 25.7);
});
