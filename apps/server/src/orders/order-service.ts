import { randomUUID } from "node:crypto";
import type { CreateOrderInput } from "@vega/domain";
import type { Prisma } from "@prisma/client";
import { prisma } from "../prisma.js";
import { emailDefaults } from "../mail/email-template.js";

export async function createOrder(input: CreateOrderInput, source: "public" | "admin", actorName = "-") {
  const normalizedInput = await normalizeOrderCatalogInput(input);
  const customerName = `${normalizedInput.customer.firstName} ${normalizedInput.customer.lastName}`.trim();
  const data = JSON.parse(JSON.stringify(normalizedInput)) as Prisma.InputJsonValue;

  return prisma.$transaction(async (transaction) => {
    const sequence = await transaction.orderNumberSequence.update({
      where: { id: 1 },
      data: { nextValue: { increment: 1 } },
      select: { nextValue: true },
    });
    const orderNumber = sequence.nextValue - 1;
    const order = await transaction.order.create({
      data: {
        id: randomUUID(), orderNumber, customerName, customerEmail: normalizedInput.customer.email || null,
        customerPhone: normalizedInput.customer.phone,
        // `source` is the business-facing acquisition channel displayed in the
        // order list, never the technical caller type (public/admin).
        source: normalizedInput.orderSource ?? (source === "public" ? "umzugruckzuck24.de" : "individuelle"),
        data,
      }, select: { id: true },
    });
    await transaction.orderActivityEvent.create({
      data: { id: randomUUID(), orderId: order.id, action: source === "public" ? "CREATED_PUBLIC" : "CREATED_ADMIN", actorName },
    });
    let outboxId: string | undefined;
    if (source === "public" && normalizedInput.customer.email) {
      const draft = emailDefaults.inquiryReceived(customerName, orderNumber);
      const outbox = await transaction.emailOutbox.create({ data: {
        id: randomUUID(), orderId: order.id, kind: "INQUIRY_RECEIVED", recipients: [normalizedInput.customer.email], subject: draft.subject,
        contentHtml: draft.contentHtml, idempotencyKey: `order:${order.id}:inquiry-received:customer`, nextAttemptAt: new Date(),
      }, select: { id: true } });
      outboxId = outbox.id;
    }
    return { orderNumber, outboxId };
  });
}

export async function normalizeOrderCatalogInput(input: CreateOrderInput): Promise<CreateOrderInput> {
  let normalizedInput = input;
  const catalogIds = [...new Set(input.details?.furniture.items.flatMap((item) => item.catalogId === undefined ? [] : [item.catalogId]) ?? [])];
  if (catalogIds.length > 0) {
    const catalogFurniture = await prisma.catalogFurniture.findMany({
      where: { id: { in: catalogIds } },
      include: { categories: { include: { category: { select: { name: true } } } } },
    });
    if (catalogFurniture.length !== catalogIds.length) throw new Error("INVALID_ORDER_CATALOG_REFERENCE");
    const byId = new Map(catalogFurniture.map((item) => [item.id, item]));
    normalizedInput = {
      ...input,
      details: {
        ...input.details!,
        furniture: {
          ...input.details!.furniture,
          items: input.details!.furniture.items.map((item) => {
            if (item.catalogId === undefined) return item;
            const catalogItem = byId.get(item.catalogId);
            if (!catalogItem) throw new Error("INVALID_ORDER_CATALOG_REFERENCE");
            const { category: _untrustedCategory, ...itemWithoutCategory } = item;
            const category = catalogItem.categories[0]?.category.name;
            return {
              ...itemWithoutCategory,
              name: catalogItem.name,
              volume: Number(catalogItem.volume),
              ...(category !== undefined ? { category } : {}),
            };
          }),
        },
      },
    };
  }

  const submittedServices = normalizedInput.details?.extras.services ?? [];
  const selectedServiceIds = [...new Set(submittedServices.flatMap((service) => service.catalogId === undefined ? [] : [service.catalogId]))];
  if (selectedServiceIds.length > 0) {
    const [serviceItems, packingItems] = await Promise.all([
      prisma.catalogService.findMany({ where: { id: { in: selectedServiceIds }, show: true }, select: { id: true, name: true } }),
      prisma.catalogPacking.findMany({ where: { id: { in: selectedServiceIds }, show: true }, select: { id: true, name: true } }),
    ]);
    const namesByKind = {
      service: new Map(serviceItems.map((item) => [item.id, item.name])),
      packaging: new Map(packingItems.map((item) => [item.id, item.name])),
    };
    normalizedInput = {
      ...normalizedInput,
      details: {
        ...normalizedInput.details!,
        extras: {
          ...normalizedInput.details!.extras,
          services: submittedServices.map((service) => {
            if (service.catalogId === undefined) return service;
            const catalogName = namesByKind[service.kind].get(service.catalogId);
            if (!catalogName) throw new Error("INVALID_ORDER_CATALOG_REFERENCE");
            return { ...service, name: catalogName };
          }),
        },
      },
    };
  }
  return normalizedInput;
}
