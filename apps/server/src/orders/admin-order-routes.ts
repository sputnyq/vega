import { randomUUID } from "node:crypto";
import type { Prisma } from "../generated/prisma/client.js";
import { Router, type Response } from "express";
import { prisma } from "../prisma.js";
import { createAdminRateLimit } from "../http-rate-limit.js";
import { validateOrderCreateInput } from "./order-input.js";
import { normalizeOrderCatalogInput } from "./order-service.js";
import { orderDataWithRelations, orderRelationCreates, orderRelations } from "./order-relations.js";
import { listPackings, listServices, listServiceRates } from "../catalog/catalog-service.js";
import { generateOrderPdf, orderPdfFilename } from "../pdf/order-pdf.js";

const PAGE_SIZE_MAX = 100;
const ARCHIVE_RETENTION_DAYS = 60;

export function createAdminOrderRouter() {
  const router = Router();
  // Standard per-staff limiter at the router boundary (app-level admin
  // limiter also applies; both use generous quotas for staff workflows).
  router.use(createAdminRateLimit());

  router.get("/", async (req, res, next) => {
    try {
      const archived = req.query.archived === "true";
      const search = typeof req.query.search === "string" ? req.query.search.trim().slice(0, 100) : "";
      const page = parsePositiveInteger(req.query.page) ?? 1;
      const pageSize = Math.min(parsePositiveInteger(req.query.pageSize) ?? 25, PAGE_SIZE_MAX);
      const where: Prisma.OrderWhereInput = {
        archivedAt: archived ? { not: null } : null,
        ...(search ? { OR: [
          { customerName: { contains: search } },
          { customerEmail: { contains: search } },
          ...(/^\d+$/u.test(search) ? [{ orderNumber: Number(search) }] : []),
        ] } : {}),
      };
      const [total, orders] = await prisma.$transaction([
        prisma.order.count({ where }),
        prisma.order.findMany({ where, orderBy: { createdAt: "desc" }, skip: (page - 1) * pageSize, take: pageSize, select: orderListSelect }),
      ]);
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: { items: orders.map(toOrderListItem), page, pageSize, total } });
    } catch (error) { next(error); }
  });

  router.get("/:orderNumber", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const order = await prisma.order.findUnique({ where: { orderNumber }, select: orderDetailSelect });
      if (!order) return notFound(res);
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: toOrderDetail(order) });
    } catch (error) { next(error); }
  });

  router.get("/:orderNumber/journal", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const order = await prisma.order.findUnique({ where: { orderNumber }, select: { id: true } });
      if (!order) return notFound(res);
      const [activities, emailEvents] = await Promise.all([
        prisma.orderActivityEvent.findMany({ where: { orderId: order.id }, orderBy: { createdAt: "desc" }, select: { id: true, action: true, actorName: true, createdAt: true } }),
        prisma.emailEvent.findMany({ where: { orderId: order.id }, orderBy: { sentAt: "desc" }, select: { id: true, kind: true, actorName: true, sentAt: true } }),
      ]);
      const entries = [
        ...activities.map((entry) => ({ id: entry.id, action: entry.action, actorName: entry.actorName || "-", occurredAt: entry.createdAt })),
        ...emailEvents.map((entry) => ({ id: entry.id, action: `EMAIL_SENT_${entry.kind}`, actorName: entry.actorName || "-", occurredAt: entry.sentAt })),
      ].sort((left, right) => right.occurredAt.getTime() - left.occurredAt.getTime());
      res.setHeader("Cache-Control", "no-store");
      res.json({ data: { items: entries } });
    } catch (error) { next(error); }
  });

  router.get("/:orderNumber/pdf", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const order = await prisma.order.findUnique({ where: { orderNumber }, include: orderRelations });
      if (!order) return notFound(res);
      const [services, packings, rates] = await Promise.all([listServices(), listPackings(), listServiceRates()]);
      const input = {
        orderNumber, data: orderDataWithRelations(order), rates,
        services: [
          ...services.map((service) => ({ ...service, kind: "service" as const })),
          ...packings.map((packing) => ({ ...packing, kind: "packaging" as const })),
        ],
      };
      const pdf = generateOrderPdf(input);
      await prisma.orderActivityEvent.create({
        data: { id: randomUUID(), orderId: order.id, action: "PDF_EXPORTED", actorName: String(res.locals.staffUser.name) },
      });
      res.setHeader("Cache-Control", "no-store");
      res.setHeader("Content-Type", "application/pdf");
      res.setHeader("Content-Disposition", `attachment; filename*=UTF-8''${encodeURIComponent(orderPdfFilename(input))}`);
      res.status(200).send(pdf);
    } catch (error) { next(error); }
  });

  router.post("/:orderNumber/copy", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const actorName = String(res.locals.staffUser.name);
      const copy = await prisma.$transaction(async (tx) => {
        const source = await tx.order.findFirst({ where: { orderNumber, archivedAt: null }, include: orderRelations });
        if (!source) throw new Error("ORDER_NOT_FOUND");
        const sequence = await tx.orderNumberSequence.update({ where: { id: 1 }, data: { nextValue: { increment: 1 } }, select: { nextValue: true } });
        const copied = await tx.order.create({ data: {
          id: randomUUID(), orderNumber: sequence.nextValue - 1, customerName: source.customerName,
          customerEmail: source.customerEmail, customerPhone: source.customerPhone, source: source.source,
          data: source.data as Prisma.InputJsonValue, edited: true, originOrderId: source.originOrderId ?? source.id,
          ...orderRelationCreates(orderDataWithRelations(source)),
        }, select: { id: true, orderNumber: true } });
        const images = await tx.orderImage.findMany({ where: { orderId: source.id } });
        if (images.length) await tx.orderImage.createMany({ data: images.map((image) => ({
          ...image, id: randomUUID(), orderId: copied.id, tokenHash: "",
        })) });
        await tx.orderActivityEvent.create({ data: { id: randomUUID(), orderId: copied.id, action: "COPIED", actorName } });
        return copied;
      }).catch((error: unknown) => error instanceof Error && error.message === "ORDER_NOT_FOUND" ? null : Promise.reject(error));
      if (!copy) return notFound(res);
      res.status(201).json({ data: { orderNumber: copy.orderNumber } });
    } catch (error) { next(error); }
  });

  router.put("/:orderNumber", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const validation = validateOrderCreateInput(req.body, { allowStaffPricing: true, allowIncomplete: true });
      if (!validation.ok) return invalidOrder(res, validation.issues);
      if (validation.value.imageClaims?.length) return invalidOrder(res, [{ field: "imageClaims", message: "Bilder können nur bei der Anfrageanlage zugeordnet werden." }]);
      let normalized;
      try { normalized = await normalizeOrderCatalogInput(validation.value); }
      catch (error) {
        if (error instanceof Error && error.message === "INVALID_ORDER_CATALOG_REFERENCE") {
          res.status(400).json({ error: { code: "INVALID_ORDER_CATALOG_REFERENCE", message: "Eine ausgewählte Katalogposition ist nicht mehr verfügbar." } });
          return;
        }
        throw error;
      }
      const customerName = `${normalized.customer.firstName} ${normalized.customer.lastName}`.trim();
      const actorName = String(res.locals.staffUser.name);
      try {
        const order = await prisma.$transaction(async (tx) => {
          const existing = await tx.order.findUnique({ where: { orderNumber }, select: { id: true, archivedAt: true } });
          if (!existing) throw new Error("ORDER_NOT_FOUND");
          if (existing.archivedAt) throw new Error("ORDER_ARCHIVED");
          const relations = orderRelationCreates(normalized);
          const updated = await tx.order.update({ where: { id: existing.id }, data: {
            customerName, customerEmail: normalized.customer.email || null, customerPhone: normalized.customer.phone,
            source: normalized.orderSource ?? "individuelle", data: JSON.parse(JSON.stringify(normalized)) as Prisma.InputJsonValue, edited: true,
            addresses: { deleteMany: {}, ...relations.addresses },
            positions: { deleteMany: {}, ...relations.positions },
          }, select: orderDetailSelect });
          await tx.orderActivityEvent.create({ data: { id: randomUUID(), orderId: updated.id, action: "UPDATED", actorName } });
          return updated;
        });
        res.setHeader("Cache-Control", "no-store");
        res.json({ data: toOrderDetail(order) });
      } catch (error) {
        if (isMissingOrder(error)) return notFound(res);
        if (error instanceof Error && error.message === "ORDER_NOT_FOUND") return notFound(res);
        if (error instanceof Error && error.message === "ORDER_ARCHIVED") {
          res.status(409).json({ error: { code: "ORDER_ARCHIVED", message: "Archivierte Aufträge müssen vor der Bearbeitung wiederhergestellt werden." } });
          return;
        }
        throw error;
      }
    } catch (error) { next(error); }
  });

  router.post("/:orderNumber/archive", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const now = new Date();
      const purgeAt = new Date(now.getTime() + ARCHIVE_RETENTION_DAYS * 24 * 60 * 60 * 1000);
      const actorName = String(res.locals.staffUser.name);
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findFirst({ where: { orderNumber, archivedAt: null }, select: { id: true } });
        if (!existing) throw new Error("ORDER_NOT_FOUND");
        const order = await tx.order.update({ where: { id: existing.id }, data: { archivedAt: now, purgeAt }, select: { id: true, orderNumber: true, archivedAt: true, purgeAt: true } });
        await tx.orderActivityEvent.create({ data: { id: randomUUID(), orderId: order.id, action: "ARCHIVED", actorName } });
        return order;
      }).catch((error: unknown) => isMissingOrder(error) || (error instanceof Error && error.message === "ORDER_NOT_FOUND") ? null : Promise.reject(error));
      if (!updated) return notFound(res);
      res.json({ data: updated });
    } catch (error) { next(error); }
  });

  router.post("/:orderNumber/restore", async (req, res, next) => {
    try {
      const orderNumber = parseOrderNumber(req.params.orderNumber);
      if (orderNumber === null) return notFound(res);
      const actorName = String(res.locals.staffUser.name);
      const updated = await prisma.$transaction(async (tx) => {
        const existing = await tx.order.findFirst({ where: { orderNumber, archivedAt: { not: null } }, select: { id: true } });
        if (!existing) throw new Error("ORDER_NOT_FOUND");
        const order = await tx.order.update({ where: { id: existing.id }, data: { archivedAt: null, purgeAt: null }, select: { id: true, orderNumber: true } });
        await tx.orderActivityEvent.create({ data: { id: randomUUID(), orderId: order.id, action: "RESTORED", actorName } });
        return order;
      }).catch((error: unknown) => isMissingOrder(error) || (error instanceof Error && error.message === "ORDER_NOT_FOUND") ? null : Promise.reject(error));
      if (!updated) return notFound(res);
      res.json({ data: updated });
    } catch (error) { next(error); }
  });
  return router;
}

const orderListSelect = { orderNumber: true, customerName: true, source: true, createdAt: true, updatedAt: true, edited: true, archivedAt: true, purgeAt: true, originOrderId: true, data: true, ...orderRelations } satisfies Prisma.OrderSelect;
const orderDetailSelect = { id: true, ...orderListSelect, data: true, originOrderId: true } satisfies Prisma.OrderSelect;

function toOrderListItem(order: Prisma.OrderGetPayload<{ select: typeof orderListSelect }>) {
  const data = asRecord(orderDataWithRelations(order));
  const from = asRecord(data?.from);
  const to = asRecord(data?.to);
  const basis = asRecord(asRecord(data?.details)?.basis);
  return {
    orderNumber: order.orderNumber,
    source: order.source,
    customerName: order.customerName,
    movingDate: stringValue(data?.movingDate),
    fromAddress: addressValue(from), fromParkingSlot: from?.parkingSlot === true,
    toAddress: addressValue(to), toParkingSlot: to?.parkingSlot === true,
    workers: numberValue(basis?.workers), trucks: numberValue(basis?.trucks), hours: numberValue(basis?.hours),
    createdAt: order.createdAt, editedAt: order.edited ? order.updatedAt : null,
    isCopy: order.originOrderId !== null, archivedAt: order.archivedAt,
  };
}
function toOrderDetail(order: Prisma.OrderGetPayload<{ select: typeof orderDetailSelect }>) {
  const { addresses: _addresses, positions: _positions, ...detail } = order;
  return { ...detail, data: orderDataWithRelations(order) };
}
function parsePositiveInteger(value: unknown): number | null { return typeof value === "string" && /^\d+$/u.test(value) && Number(value) > 0 ? Number(value) : null; }
function parseOrderNumber(value: unknown): number | null { const parsed = parsePositiveInteger(value); return parsed && parsed <= 2_147_483_647 ? parsed : null; }
function notFound(res: Response) { res.status(404).json({ error: { code: "ORDER_NOT_FOUND", message: "Auftrag nicht gefunden." } }); }
function invalidOrder(res: Response, issues: unknown) { res.status(400).json({ error: { code: "INVALID_ORDER", message: "Bitte prüfen Sie die Auftragsdaten.", issues } }); }
function isMissingOrder(error: unknown): boolean { return typeof error === "object" && error !== null && "code" in error && error.code === "P2025"; }
function asRecord(value: unknown): Record<string, unknown> | undefined { return typeof value === "object" && value !== null && !Array.isArray(value) ? value as Record<string, unknown> : undefined; }
function stringValue(value: unknown): string { return typeof value === "string" ? value : ""; }
function numberValue(value: unknown): number | null { return typeof value === "number" && Number.isFinite(value) ? value : null; }
function addressValue(address: Record<string, unknown> | undefined): string { return [stringValue(address?.street), stringValue(address?.postalCode), stringValue(address?.city)].filter(Boolean).join(", "); }
