import "dotenv/config";
import { prisma } from "../apps/server/src/prisma.js";
import { buildLegacyCatalogImportPlan } from "../apps/server/src/catalog/legacy-import.js";

const ENDPOINTS = {
  boxCbm: "https://www.umzug-meister.de/wp-json/um-configurator/v1/options/boxCbm",
  kleiderboxCbm: "https://www.umzug-meister.de/wp-json/um-configurator/v1/options/kleiderboxCbm",
  items: "https://www.umzug-meister.de/wp-json/um-configurator/v1/item/all",
  categories: "https://www.umzug-meister.de/wp-json/um-configurator/v1/item-category/all",
  services: "https://www.umzug-meister.de/wp-json/um-configurator/v1/service/all",
} as const;

async function fetchJson(url: string): Promise<unknown> {
  const response = await fetch(url, { headers: { accept: "application/json" } });
  if (!response.ok) throw new Error(`Legacy-Endpunkt ${url} antwortete mit HTTP ${response.status}.`);
  return response.json();
}

async function loadPayload() {
  const [box, kleiderbox, items, categories, services] = await Promise.all([
    fetchJson(ENDPOINTS.boxCbm),
    fetchJson(ENDPOINTS.kleiderboxCbm),
    fetchJson(ENDPOINTS.items),
    fetchJson(ENDPOINTS.categories),
    fetchJson(ENDPOINTS.services),
  ]);
  const optionValue = (value: unknown): unknown => (typeof value === "object" && value !== null && "value" in value ? (value as { value: unknown }).value : value);
  return { boxCbm: optionValue(box), kleiderboxCbm: optionValue(kleiderbox), items, categories, services };
}

async function applyPlan(plan: ReturnType<typeof buildLegacyCatalogImportPlan>): Promise<void> {
  await prisma.$transaction(async (tx) => {
    await tx.appSettings.update({
      where: { id: 1 },
      data: { boxCbm: plan.boxCbm, kleiderboxCbm: plan.kleiderboxCbm, revision: { increment: 1 } },
    });
    // Der Import ersetzt den Katalog vollständig; Zeilen mit fremden Alt-IDs würden sonst Dubletten erzeugen.
    await tx.catalogFurnitureCategory.deleteMany();
    await tx.catalogFurniture.deleteMany();
    await tx.catalogCategory.deleteMany();
    await tx.catalogService.deleteMany();
    await tx.catalogPacking.deleteMany();
    await tx.catalogOffer.deleteMany();

    const categoryIds = new Map<string, number>();
    for (const category of plan.categories) {
      const created = await tx.catalogCategory.create({ data: category.input });
      categoryIds.set(category.input.name, created.id);
    }
    for (const furniture of plan.furniture) {
      const { categoryIds: _categoryIds, ...data } = furniture.input;
      const created = await tx.catalogFurniture.create({ data });
      const links = furniture.categoryNames
        .map((name) => categoryIds.get(name))
        .filter((id): id is number => id !== undefined)
        .map((categoryId) => ({ furnitureId: created.id, categoryId }));
      if (links.length) await tx.catalogFurnitureCategory.createMany({ data: links });
    }
    for (const service of plan.services) await tx.catalogService.create({ data: service.input });
    for (const packing of plan.packings) await tx.catalogPacking.create({ data: packing.input });
    for (const offer of plan.offers) await tx.catalogOffer.create({ data: offer.input });
  });
}

try {
  const apply = process.argv.includes("--apply");
  const unknownArgs = process.argv.slice(2).filter((arg) => arg !== "--apply");
  if (unknownArgs.length) throw new Error(`Unbekannte Argumente: ${unknownArgs.join(" ")}. Zulässig ist nur --apply.`);

  const plan = buildLegacyCatalogImportPlan(await loadPayload());
  console.info(
    `Legacy-Katalog: ${plan.categories.length} Kategorien, ${plan.furniture.length} Möbel, ${plan.services.length} Services, ${plan.packings.length} Packmaterialien, ${plan.offers.length} Angebote, ` +
      `Umzugskarton ${plan.boxCbm ?? "–"} m³, Kleiderbox ${plan.kleiderboxCbm ?? "–"} m³.`,
  );
  for (const skipped of plan.skipped) console.info(`Hinweis: ${skipped}`);

  if (!apply) {
    console.info("Vorschau ohne Datenänderung. Mit --apply wird der Import geschrieben.");
  } else {
    await applyPlan(plan);
    console.info("Legacy-Katalog in die Datenbank übernommen.");
  }
} finally {
  await prisma.$disconnect();
}
