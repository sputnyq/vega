import type { Buffer } from "node:buffer";
import { addInvoiceAmounts, formatGermanDate, reminderDelayDays } from "@vega/domain";
import type { Invoice, ReminderEvent } from "../generated/prisma/client.js";
import { calculateInvoiceTotals, drawBankFooter, drawHeading, drawTotals, drawTable, drawText, euro, filenameName, formatDate, PAGE, parseEntries, startAccountingPdf } from "./accounting-pdf.js";

type ReminderInvoice = Pick<Invoice, "invoiceNumber" | "invoiceDate" | "company" | "customerNameSnapshot" | "customerStreet" | "customerPostalCity" | "entries" | "taxPercent">;

/** Legacy PaymentReminderPdf; `previousDueDate` is the invoice due date for level 1. */
export async function generateReminderPdf(reminder: ReminderEvent, invoice: ReminderInvoice, previousDueDate: string, today = new Date()): Promise<Buffer> {
  const { doc, done } = startAccountingPdf(`${reminder.level}. Mahnung ${reminder.invoiceNumberSnapshot}`, [`München, ${formatDate(today)}`], [invoice.company, invoice.customerNameSnapshot, invoice.customerStreet, invoice.customerPostalCity]);
  drawHeading(doc, `${reminder.level}. Mahnung`, 356.6, 14);
  let y = drawText(doc, reminder.text, 385) + 14;
  const columns = [PAGE.left, PAGE.left + PAGE.width / 3, PAGE.left + PAGE.width * 2 / 3, PAGE.right];
  const center: Array<"center"> = ["center", "center", "center"];
  const gross = calculateInvoiceTotals(parseEntries(invoice.entries), Number(invoice.taxPercent)).total;
  y = drawTable(doc, ["Rechnung Nr.", "vom", "Betrag"], [[invoice.invoiceNumber, formatDate(invoice.invoiceDate), euro(gross)]], columns, y, center) + 14;
  const dueDate = reminder.dueDate.toISOString().slice(0, 10);
  const outstanding = Number(reminder.outstandingAmount);
  y = drawTable(doc, ["Offener Betrag", "Fälligkeit", "Verzug"], [[euro(outstanding), formatGermanDate(previousDueDate), `${reminderDelayDays(previousDueDate, dueDate)} Tage`]], columns, y, center, "#ff0000") + 14;
  const fee = Number(reminder.fee);
  y = drawTotals(doc, [`Mahngebühr:   ${euro(fee)}`, `Summe fälliger Posten:   ${euro(addInvoiceAmounts([outstanding, fee]))}`], y, 40, 0);
  drawBankFooter(doc, Math.max(y, 725));
  doc.end(); return done;
}

export function reminderPdfFilename(reminder: Pick<ReminderEvent, "level" | "invoiceNumberSnapshot" | "customerNameSnapshot">, company: string): string {
  return `Mahnung Nr.${reminder.level} ${reminder.invoiceNumberSnapshot} ${filenameName(company, reminder.customerNameSnapshot, "Kunde")}.pdf`;
}
