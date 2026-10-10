import { Router, type Response } from "express";
import type { InvoiceInput } from "@vega/domain";
import { prisma } from "../prisma.js";
import { generateInvoicePdf, invoicePdfFilename } from "../pdf/invoice-pdf.js";
import { orderDataWithRelations, orderRelations } from "../orders/order-relations.js";
import { toInvoiceDto, validateInvoice } from "./invoice-input.js";
import {
  archiveInvoice,
  createInvoice,
  recordInvoicePdfExport,
  restoreInvoice,
  updateInvoice,
} from "./invoice-service.js";

export function createInvoiceRouter() {
  const router = Router();
  router.get("/", async (req, res, next) => {
    try {
      const archived = req.query.archived === "true";
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
      const invoices = await prisma.invoice.findMany({ where: { archivedAt: archived ? { not: null } : null, ...(search ? { OR: [{ invoiceNumber: { contains: search } }, { customerNameSnapshot: { contains: search } }, ...(/^\d+$/u.test(search) ? [{ orderNumberSnapshot: Number(search) }] : [])] } : {}) }, orderBy: { createdAt: "desc" }, take: 100 });
      res.json({ data: { items: invoices.map(toInvoiceDto) } });
    } catch (error) { next(error); }
  });
  router.get("/:id", async (req, res, next) => {
    try { const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } }); if (!invoice) return notFound(res); res.json({ data: toInvoiceDto(invoice) }); } catch (error) { next(error); }
  });
  router.get("/:id/pdf", async (req, res, next) => {
    try {
      const invoice = await prisma.invoice.findUnique({ where: { id: req.params.id } });
      if (!invoice) return notFound(res);
      const pdf = await generateInvoicePdf(invoice);
      if (invoice.orderId) await recordInvoicePdfExport(invoice.orderId, String(res.locals.staffUser.name));
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
      res.status(201).json({ data: toInvoiceDto(invoice) });
    } catch (error) { next(error); }
  });
  router.get("/from-order/:orderNumber", async (req, res, next) => {
    try {
      const orderNumber = Number(req.params.orderNumber); if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) return notFound(res);
      const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderRelations }); if (!order) return notFound(res);
      const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
      if (existing) { res.status(409).json({ error: { code: "INVOICE_ALREADY_EXISTS", message: "Für diesen Auftrag existiert bereits eine Rechnung." } }); return; }
      const data = orderDataWithRelations(order);
      const customer = data.customer;
      const destination = data.to;
      const input: InvoiceInput = { invoiceDate: new Date().toISOString().slice(0, 10), company: stringValue(customer?.company), customerName: order.customerName, customerStreet: stringValue(destination?.street), customerPostalCity: [stringValue(destination?.postalCode), stringValue(destination?.city)].filter(Boolean).join(" "), taxPercent: 19, text: "", entries: [], dueDates: [] };
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: input });
    } catch (error) { next(error); }
  });
  router.post("/from-order/:orderNumber", async (req, res, next) => {
    try {
      const orderNumber = Number(req.params.orderNumber);
      if (!Number.isSafeInteger(orderNumber) || orderNumber < 1) return notFound(res);
      const input = validateInvoice(req.body);
      if (!input.ok) return invalid(res, input.message);
      const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true, orderNumber: true } });
      if (!order) return notFound(res);
      const existing = await prisma.invoice.findUnique({ where: { orderId: order.id } });
      if (existing) {
        res.status(409).json({ error: { code: "INVOICE_ALREADY_EXISTS", message: "Für diesen Auftrag existiert bereits eine Rechnung." } });
        return;
      }
      const invoice = await createInvoice(input.value, order);
      res.status(201).json({ data: toInvoiceDto(invoice) });
    } catch (error) {
      if (isUnique(error)) {
        res.status(409).json({ error: { code: "INVOICE_CONFLICT", message: "Die Rechnungsnummer oder der Auftrag ist bereits einer Rechnung zugeordnet." } });
        return;
      }
      next(error);
    }
  });
  router.put("/:id", async (req, res, next) => {
    try {
      const input = validateInvoice(req.body); if (!input.ok) return invalid(res, input.message);
      const existing = await prisma.invoice.findUnique({ where: { id: req.params.id } }); if (!existing) return notFound(res);
      if (existing.archivedAt) { res.status(409).json({ error: { code: "INVOICE_ARCHIVED", message: "Archivierte Rechnungen müssen zuerst wiederhergestellt werden." } }); return; }
      const invoice = await updateInvoice(existing.id, input.value, existing.invoiceNumber);
      res.json({ data: toInvoiceDto(invoice) });
    } catch (error) { if (isUnique(error)) { res.status(409).json({ error: { code: "INVOICE_NUMBER_IN_USE", message: "Diese Rechnungsnummer wird bereits verwendet." } }); return; } next(error); }
  });
  router.post("/:id/archive", async (req, res, next) => {
    try { const invoice = await archiveInvoice(req.params.id, new Date()); res.json({ data: toInvoiceDto(invoice) }); } catch (error) { if (isMissing(error)) return notFound(res); next(error); }
  });
  router.post("/:id/restore", async (req, res, next) => {
    try { const invoice = await restoreInvoice(req.params.id); res.json({ data: toInvoiceDto(invoice) }); } catch (error) { if (isMissing(error)) return notFound(res); next(error); }
  });
  return router;
}
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function notFound(res: Response) { res.status(404).json({ error: { code: "INVOICE_NOT_FOUND", message: "Rechnung nicht gefunden." } }); }
function invalid(res: Response, message: string) { res.status(400).json({ error: { code: "INVALID_INVOICE", message } }); }
function isMissing(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"; }
function isUnique(error: unknown) { return typeof error === "object" && error !== null && "code" in error && error.code === "P2002"; }
