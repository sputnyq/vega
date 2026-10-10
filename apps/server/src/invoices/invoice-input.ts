import type { Prisma } from "@prisma/client";
import type { InvoiceInput } from "@vega/domain";

export function validateInvoice(value: unknown): { ok: true; value: InvoiceInput } | { ok: false; message: string } {
  if (!isRecord(value)) return { ok: false, message: "Ungültige Rechnungsdaten." };
  const strings = ["invoiceDate", "company", "customerName", "customerStreet", "customerPostalCity", "text"] as const;
  if (strings.some((key) => typeof value[key] !== "string") || typeof value.taxPercent !== "number" || !Number.isFinite(value.taxPercent) || value.taxPercent < 0 || value.taxPercent > 100 || !Array.isArray(value.entries) || !Array.isArray(value.dueDates)) return { ok: false, message: "Bitte prüfen Sie die Rechnungsdaten." };
  if (!/^\d{4}-\d{2}-\d{2}$/u.test(value.invoiceDate as string) || (value.customerName as string).trim().length === 0) return { ok: false, message: "Rechnungsdatum und Kunde sind erforderlich." };
  const entries = value.entries as unknown[];
  if (entries.length > 200 || entries.some((entry) => !isRecord(entry) || typeof entry.description !== "string" || typeof entry.quantity !== "number" || typeof entry.unitPrice !== "number" || entry.quantity < 0 || entry.unitPrice < 0)) return { ok: false, message: "Ungültige Rechnungspositionen." };
  const dueDates = value.dueDates as unknown[];
  if (dueDates.length > 20 || dueDates.some((entry) => !isRecord(entry) || typeof entry.date !== "string" || typeof entry.amount !== "number" || typeof entry.text !== "string" || entry.amount < 0)) return { ok: false, message: "Ungültige Fälligkeiten." };
  const invoiceNumber = typeof value.invoiceNumber === "string" && value.invoiceNumber.trim() ? value.invoiceNumber.trim().slice(0, 64) : undefined;
  return { ok: true, value: { ...(invoiceNumber ? { invoiceNumber } : {}), invoiceDate: value.invoiceDate as string, company: (value.company as string).trim().slice(0, 191), customerName: (value.customerName as string).trim().slice(0, 300), customerStreet: (value.customerStreet as string).trim().slice(0, 191), customerPostalCity: (value.customerPostalCity as string).trim().slice(0, 191), taxPercent: value.taxPercent as number, text: (value.text as string).slice(0, 10000), entries: entries as InvoiceInput["entries"], dueDates: dueDates as InvoiceInput["dueDates"] } };
}

export function invoiceData(input: InvoiceInput, invoiceNumber: string): Omit<Prisma.InvoiceUncheckedCreateInput, "id" | "orderId" | "orderNumberSnapshot"> {
  return {
    invoiceNumber,
    invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`),
    company: input.company,
    customerNameSnapshot: input.customerName,
    customerStreet: input.customerStreet,
    customerPostalCity: input.customerPostalCity,
    taxPercent: input.taxPercent,
    text: input.text,
    entries: input.entries as unknown as Prisma.InputJsonValue,
    dueDates: input.dueDates as unknown as Prisma.InputJsonValue,
  };
}

export function toInvoiceDto(invoice: Prisma.InvoiceGetPayload<object>) {
  return {
    id: invoice.id,
    invoiceNumber: invoice.invoiceNumber,
    orderNumber: invoice.orderNumberSnapshot,
    invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10),
    company: invoice.company,
    customerName: invoice.customerNameSnapshot,
    customerStreet: invoice.customerStreet,
    customerPostalCity: invoice.customerPostalCity,
    taxPercent: Number(invoice.taxPercent),
    text: invoice.text,
    entries: invoice.entries,
    dueDates: invoice.dueDates,
    archivedAt: invoice.archivedAt,
    createdAt: invoice.createdAt,
    updatedAt: invoice.updatedAt,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
