import type { InvoiceEntryInput } from "./index.js";
import { calculateInvoiceTotals, invoiceLineTotal, roundInvoiceAmount } from "./invoice-calculation.js";

/** Largest nonnegative value representable by the reminder DB columns (DECIMAL(12,2)). */
export const MAX_INVOICE_AMOUNT = 9_999_999_999.99;

export function isInvoiceAmount(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value) && value >= 0
    && value <= MAX_INVOICE_AMOUNT && roundInvoiceAmount(value) <= MAX_INVOICE_AMOUNT;
}

export function isInvoiceDate(value: unknown): value is string {
  if (typeof value !== "string" || !/^[1-9]\d{3}-\d{2}-\d{2}$/u.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function validateInvoiceEntries(value: unknown): InvoiceEntryInput[] | undefined {
  if (!Array.isArray(value) || value.length > 200) return undefined;
  const entries: InvoiceEntryInput[] = [];
  for (const entry of value) {
    if (typeof entry !== "object" || entry === null || Array.isArray(entry)
      || typeof entry.description !== "string" || entry.description.length > 2000
      || !isInvoiceAmount(entry.quantity) || !isInvoiceAmount(entry.unitPrice)
      || !isInvoiceAmount(invoiceLineTotal(entry))) return undefined;
    entries.push({ description: entry.description, quantity: entry.quantity, unitPrice: entry.unitPrice });
  }
  return isInvoiceAmount(calculateInvoiceTotals(entries, 0).net) ? entries : undefined;
}
