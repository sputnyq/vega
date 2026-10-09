import assert from "node:assert/strict";
import test from "node:test";
import { generateInvoicePdf, invoicePdfFilename } from "../src/pdf/invoice-pdf.js";

test("renders the legacy-styled invoice layout as a server-side PDF", async () => {
  const invoice = {
    invoiceNumber: "R-42", company: "Beispiel GmbH", customerNameSnapshot: "Ada Beispiel", customerStreet: "Teststraße 1", customerPostalCity: "80331 München",
    invoiceDate: new Date("2026-10-09T00:00:00.000Z"), taxPercent: 19, text: "Vielen Dank.", entries: [{ description: "Umzug", quantity: 2, unitPrice: 100 }],
  } as any;
  const pdf = await generateInvoicePdf(invoice);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  assert.equal(invoicePdfFilename(invoice), "R-R-42 Beispiel GmbH.pdf");
});
