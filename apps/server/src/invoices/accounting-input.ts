import {
  isInvoiceAmount, isInvoiceDate, roundInvoiceAmount, validateInvoiceEntries,
  type AdminCreditNoteDto, type AdminReminderDto, type CreditNoteInput, type InvoiceEntryInput, type ReminderInput,
} from "@vega/domain";
import type { CreditNote, ReminderEvent } from "../generated/prisma/client.js";

type Result<T> = { ok: true; value: T } | { ok: false; message: string };

export function validateCreditNote(value: unknown): Result<CreditNoteInput> {
  if (!isRecord(value)) return { ok: false, message: "Ungültige Gutschriftdaten." };
  const creditNumber = typeof value.creditNumber === "string" ? value.creditNumber.trim() : "";
  if (!creditNumber || creditNumber.length > 64) return { ok: false, message: "Gutschriftnummer ist erforderlich (max. 64 Zeichen)." };
  if (typeof value.creditDate !== "string" || !isIsoDate(value.creditDate)) return { ok: false, message: "Gutschriftdatum ist erforderlich." };
  if (typeof value.text !== "string" || value.text.length > 10000) return { ok: false, message: "Bitte prüfen Sie den Text (max. 10.000 Zeichen)." };
  const entries = validateInvoiceEntries(value.entries);
  if (!entries) return { ok: false, message: "Ungültige Gutschriftpositionen." };
  return { ok: true, value: { creditNumber, creditDate: value.creditDate, text: value.text.slice(0, 10000), entries } };
}

export function validateReminder(value: unknown): Result<ReminderInput> {
  if (!isRecord(value)) return { ok: false, message: "Ungültige Mahnungsdaten." };
  if (typeof value.dueDate !== "string" || !isIsoDate(value.dueDate)) return { ok: false, message: "Fälligkeitsdatum ist erforderlich." };
  if (!isInvoiceAmount(value.fee) || !isInvoiceAmount(value.outstandingAmount)) return { ok: false, message: "Mahngebühr und offener Betrag müssen zwischen 0 und 9.999.999.999,99 liegen." };
  if (typeof value.text !== "string" || value.text.length > 10000) return { ok: false, message: "Bitte prüfen Sie den Text (max. 10.000 Zeichen)." };
  return { ok: true, value: { dueDate: value.dueDate, fee: round(value.fee), outstandingAmount: round(value.outstandingAmount), text: value.text.slice(0, 10000) } };
}

export function toCreditNoteDto(credit: CreditNote): AdminCreditNoteDto {
  return {
    id: credit.id,
    invoiceId: credit.invoiceId,
    invoiceNumber: credit.invoiceNumberSnapshot,
    creditNumber: credit.creditNumber,
    creditDate: isoDate(credit.creditDate),
    company: credit.company,
    customerName: credit.customerNameSnapshot,
    customerStreet: credit.customerStreet,
    customerPostalCity: credit.customerPostalCity,
    taxPercent: Number(credit.taxPercent),
    text: credit.text,
    entries: credit.entries as unknown as InvoiceEntryInput[],
    archivedAt: credit.archivedAt?.toISOString() ?? null,
    createdAt: credit.createdAt.toISOString(),
    updatedAt: credit.updatedAt.toISOString(),
  };
}

export function toReminderDto(reminder: ReminderEvent, previousDueDate: string): AdminReminderDto {
  return {
    id: reminder.id,
    invoiceId: reminder.invoiceId,
    invoiceNumber: reminder.invoiceNumberSnapshot,
    level: reminder.level,
    previousDueDate,
    dueDate: isoDate(reminder.dueDate),
    fee: Number(reminder.fee),
    outstandingAmount: Number(reminder.outstandingAmount),
    text: reminder.text,
    sentAt: reminder.sentAt?.toISOString() ?? null,
    archivedAt: reminder.archivedAt?.toISOString() ?? null,
    createdAt: reminder.createdAt.toISOString(),
    updatedAt: reminder.updatedAt.toISOString(),
  };
}

export function isoDate(date: Date): string { return date.toISOString().slice(0, 10); }
export function dateFromIso(value: string): Date { return new Date(`${value}T00:00:00.000Z`); }
export const round = roundInvoiceAmount;
export const isIsoDate = isInvoiceDate;

function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
