import type { Buffer } from "node:buffer";
import type { Invoice } from "../generated/prisma/client.js";
import { calculateInvoiceTotals, drawBankFooter, drawEntriesTable, drawHeading, drawRight, drawText, euro, filenameName, formatDate, formatNumber, parseEntries, startAccountingPdf } from "./accounting-pdf.js";

export { calculateInvoiceTotals } from "./accounting-pdf.js";

/** Server-side rendering of the established legacy InvoicePdf layout. */
export async function generateInvoicePdf(invoice: Invoice): Promise<Buffer> {
  const information = [`Rechnungsdatum: ${formatDate(invoice.invoiceDate)}`, ...(invoice.orderNumberSnapshot ? [`Auftragsnummer: ${invoice.orderNumberSnapshot}`] : [])];
  const { doc, done } = startAccountingPdf(`Rechnung ${invoice.invoiceNumber}`, information, [invoice.company, invoice.customerNameSnapshot, invoice.customerStreet, invoice.customerPostalCity]);
  drawHeading(doc, `Rechnung Nr: ${invoice.invoiceNumber}`, 356.6);
  const entries = parseEntries(invoice.entries);
  let y = drawEntriesTable(doc, entries, 375.4);
  y = Math.max(y + 28, 462.7);
  const totals = calculateInvoiceTotals(entries, Number(invoice.taxPercent));
  drawRight(doc, [`Nettobetrag:   ${euro(totals.net)}`, `${formatNumber(Number(invoice.taxPercent))}% MwSt:     ${euro(totals.tax)}`, `Gesamtbetrag:   ${euro(totals.total)}`], y, 10); y += 55;
  y = drawText(doc, invoice.text, y);
  drawBankFooter(doc, Math.max(y, 711.7), "Die Rechnung wurde maschinell erstellt und ist ohne Unterschrift gültig.");
  doc.end(); return done;
}

export function invoicePdfFilename(invoice: Invoice): string { return `R-${invoice.invoiceNumber} ${filenameName(invoice.company, invoice.customerNameSnapshot, "Rechnung")}.pdf`; }
