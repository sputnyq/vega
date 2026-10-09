import { randomUUID } from "node:crypto";
import type { Prisma } from "@prisma/client";
import { Router, type Response } from "express";
import type { InvoiceInput } from "@vega/domain";
import { prisma } from "../prisma.js";
import { generateInvoicePdf, invoicePdfFilename } from "../pdf/invoice-pdf.js";
import { orderDataWithRelations, orderRelations } from "../orders/order-relations.js";

const RETENTION_DAYS = 30;

export function createInvoiceRouter() {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const archived = req.query.archived === "true";
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
      const invoices = await prisma.invoice.findMany({ where: { archivedAt: archived ? { not: null } : null, ...(search ? { OR: [{ invoiceNumber: { contains: search } }, { customerNameSnapshot: { contains: search } }, ...(/^\d+$/u.test(search) ? [{ orderNumberSnapshot: Number(search) }] : [])] } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
      res.json({ data: { items: invoices.map(toDto) } });
    } catch (error) { next(error); }
  });
  router.get("/:id", async (req, res, next) => {
    try { const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } }); if (!invoice) return notFound(res); res.json({ data: toDto(invoice) }); } catch (error) { next(error); }
  });
  router.get("/:id/pdf", async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) return notFound(res);
      const pdf = await generateInvoicePdf(invoice);
      if (invoice.orderId) await prisma.orderActivityEvent.create({ data: { id: randomUUID(), orderId: invoice.orderId, action: "PDF_EXPORTED", actorName: String(res.locals.staffUser.name) } });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(invoicePdfFilename(invoice))}`);
      res.status(200).send(pdf);
    } catch (error) { next(error); }
  });
  router.post("/", async (req, res, next) => {
    try {
      const input = validateInvoice(req.body); if (!input.ok) return invalid(res, input.message);
      const invoice = await createInvoice(input.value);
      res.status(201).json({ data: toDto(invoice) });
    } catch (error) { next(error); }
  });
  router.post("/from-order/:orderNumber", async (req, res, next) => {
    try {
      const orderNumber = Number(req.params.orderNumber); if (!Number.isInteger(orderNumber) || orderNumber < 1) return notFound(res);
      const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderRelations }); if (!order) return notFound(res);
      const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
      if (existing) { res.status(409).json({ error: { code: "INVOICE_ALREADY_EXISTS", message: "Für diesen Auftrag existiert bereits eine Rechnung." } }); return; }
      const data = orderDataWithRelations(order);
      const customer = data.customer;
      const destination = data.to;
      const input: InvoiceInput = { invoiceDate: new Date().toISOString().slice(0, 10), company: stringValue(customer?.company), customerName: order.customerName, customerStreet: stringValue(destination?.street), customerPostalCity: [stringValue(destination?.postalCode), stringValue(destination?.city)].filter(Boolean).join(" "), taxPercent: 19, text: "", entries: [], dueDates: [] };
      const invoice = await createInvoice(input, order);
      res.status(201).json({ data: toDto(invoice) });
    } catch (error) { next(error); }
  });
  router.put("/:id", async (req, res, next) => {
    try {
      const input = validateInvoice(req.body); if (!input.ok) return invalid(res, input.message);
      const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } }); if (!existing) return notFound(res);
      if (existing.archivedAt) { res.status(409).json({ error: { code: "INVOICE_ARCHIVED", message: "Archivierte Rechnungen müssen zuerst wiederhergestellt werden." } }); return; }
      const invoice = await prisma.invoice.update({ where: { id: existing.id }, data: invoiceData(input.value, input.value.invoiceNumber ?? existing.invoiceNumber) });
      res.json({ data: toDto(invoice) });
    } catch (error) { if (isUnique(error)) { res.status(409).json({ error: { code: "INVOICE_NUMBER_IN_USE", message: "Diese Rechnungsnummer wird bereits verwendet." } }); return; } next(error); }
  });
  router.post("/:id/archive", async (req, res, next) => {
    try { const now = new Date(); const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { archivedAt: now, purgeAt: new Date(now.getTime() + RETENTION_DAYS * 86400000) } }); res.json({ data: toDto(invoice) }); } catch (error) { if (isMissing(error)) return notFound(res); next(error); }
  });
  router.post("/:id/restore", async (req, res, next) => {
    try { const invoice = await prisma.invoice.update({ where: { id: req.params.id }, data: { archivedAt: null, purgeAt: null } }); res.json({ data: toDto(invoice) }); } catch (error) { if (isMissing(error)) return notFound(res); next(error); }
  });
  return router;
}

async function createInvoice(input: InvoiceInput, order?: { id: string; orderNumber: number }) {
  return prisma.$transaction(async (tx) => {
    const sequence = await tx.invoiceNumberSequence.update({ where: { id: 1 }, data: { nextValue: { increment: 1 } }, select: { nextValue: true } });
    const invoiceNumber = input.invoiceNumber || `R-${sequence.nextValue - 1}`;
    return tx.invoice.create({ data: { id: randomUUID(), ...(order ? { orderId: order.id, orderNumberSnapshot: order.orderNumber } : {}), ...invoiceData(input, invoiceNumber) } });
  });
}
function invoiceData(input: InvoiceInput, invoiceNumber: string): Omit<Prisma.InvoiceUncheckedCreateInput, "id" | "orderId" | "orderNumberSnapshot"> { return { invoiceNumber, invoiceDate: new Date(`${input.invoiceDate}T00:00:00.000Z`), company: input.company, customerNameSnapshot: input.customerName, customerStreet: input.customerStreet, customerPostalCity: input.customerPostalCity, taxPercent: input.taxPercent, text: input.text, entries: input.entries as unknown as Prisma.InputJsonValue, dueDates: input.dueDates as unknown as Prisma.InputJsonValue }; }
function validateInvoice(value: unknown): { ok: true; value: InvoiceInput } | { ok: false; message: string } {
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
function toDto(invoice: Prisma.InvoiceGetPayload<object>) { return { id: invoice.id, invoiceNumber: invoice.invoiceNumber, orderNumber: invoice.orderNumberSnapshot, invoiceDate: invoice.invoiceDate.toISOString().slice(0, 10), company: invoice.company, customerName: invoice.customerNameSnapshot, customerStreet: invoice.customerStreet, customerPostalCity: invoice.customerPostalCity, taxPercent: Number(invoice.taxPercent), text: invoice.text, entries: invoice.entries, dueDates: invoice.dueDates, archivedAt: invoice.archivedAt, createdAt: invoice.createdAt, updatedAt: invoice.updatedAt }; }
function isRecord(value: unknown): value is Record<string, unknown> { return typeof value === "object" && value !== null && !Array.isArray(value); }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function notFound(res: Response) { res.status(404).json({ error: { code: "INVOICE_NOT_FOUND", message: "Rechnung nicht gefunden." } }); }
function invalid(res: Response, message: string) { res.status(400).json({ error: { code: "INVALID_INVOICE", message } }); }
function isMissing(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"; }
function isUnique(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
