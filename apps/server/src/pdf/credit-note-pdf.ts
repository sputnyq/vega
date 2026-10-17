import type { Buffer } from "node:buffer";
import type { CreditNote } from "../generated/prisma/client.js";
import { calculateInvoiceTotals, drawBankFooter, drawEntriesTable, drawHeading, drawTotals, drawText, euro, filenameName, formatDate, formatNumber, parseEntries, startAccountingPdf } from "./accounting-pdf.js";

/** Legacy CreditPdf: invoice layout with negated amounts. */
export async function generateCreditNotePdf(credit: CreditNote): Promise<Buffer> {
  const { doc, done } = startAccountingPdf(`Gutschrift ${credit.creditNumber}`, [`München, ${formatDate(credit.creditDate)}`], [credit.company, credit.customerNameSnapshot, credit.customerStreet, credit.customerPostalCity]);
  drawHeading(doc, `Gutschrift Nr: ${credit.creditNumber}  /  Rechnung Nr: ${credit.invoiceNumberSnapshot}`, 356.6);
  const entries = parseEntries(credit.entries);
  let y = drawEntriesTable(doc, entries, 375.4, -1);
  const taxPercent = Number(credit.taxPercent);
  const totals = calculateInvoiceTotals(entries, taxPercent);
  y = drawTotals(doc, [`Nettobetrag:   - ${euro(totals.net)}`, `${formatNumber(taxPercent)}% MwSt:     - ${euro(totals.tax)}`, `Gesamtbetrag:   - ${euro(totals.total)}`], y + 28);
  y = drawText(doc, credit.text, y);
  drawBankFooter(doc, Math.max(y, 725));
  doc.end(); return done;
}

export function creditNotePdfFilename(credit: Pick<CreditNote, "creditNumber" | "company" | "customerNameSnapshot">): string {
  return `G-${credit.creditNumber} ${filenameName(credit.company, credit.customerNameSnapshot, "Gutschrift")}.pdf`;
}
