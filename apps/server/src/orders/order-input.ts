import type {
  CreateOrderInput,
  OrderAddressInput,
  OrderConditionInput,
  OrderDetailsInput,
  OrderFurnitureInput,
  OrderServiceInput,
} from "@vega/domain";

export interface OrderInputIssue {
  field: string;
  message: string;
}

export type OrderInputValidation =
  | { ok: true; value: CreateOrderInput }
  | { ok: false; issues: OrderInputIssue[] };

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/u;
const DATE_PATTERN = /^\d{4}-\d{2}-\d{2}$/u;
const TIME_PATTERN = /^\d{2}:\d{2}$/u;
const ORDER_SOURCES = ["express", "individuelle", "Moebelliste", "UmzugRuckZuck", "check24", "umzugruckzuck24.de"] as const;
const BUILDING_TYPES = ["Wohnung", "Haus", "Keller", "Lager", "Büro"] as const;
const LIFT_TYPES = ["kein Aufzug", "2 Personen", "4 Personen", "6 Personen", "8+ Personen"] as const;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function text(
  source: Record<string, unknown>,
  key: string,
  field: string,
  issues: OrderInputIssue[],
  { required = false, max = 200 }: { required?: boolean; max?: number } = {},
): string | undefined {
  const value = source[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "string") {
    issues.push({ field, message: required ? "Dieses Feld ist erforderlich." : "Ungültiger Wert." });
    return undefined;
  }
  const trimmed = value.trim();
  if (required && !trimmed) issues.push({ field, message: "Dieses Feld ist erforderlich." });
  if (trimmed.length > max) issues.push({ field, message: `Maximal ${max} Zeichen erlaubt.` });
  return trimmed;
}

function numeric(
  source: Record<string, unknown>,
  key: string,
  field: string,
  issues: OrderInputIssue[],
  { required = false, max = 1_000_000 }: { required?: boolean; max?: number } = {},
): number | undefined {
  const value = source[key];
  if (value === undefined && !required) return undefined;
  if (typeof value !== "number" || !Number.isFinite(value) || value < 0 || value > max) {
    issues.push({ field, message: `Bitte geben Sie eine Zahl zwischen 0 und ${max} ein.` });
    return undefined;
  }
  return value;
}

function bool(source: Record<string, unknown>, key: string, field: string, issues: OrderInputIssue[]): boolean | undefined {
  const value = source[key];
  if (value === undefined) return undefined;
  if (typeof value !== "boolean") {
    issues.push({ field, message: "Ungültiger Wert." });
    return undefined;
  }
  return value;
}

function validateAddress(value: unknown, prefix: string, issues: OrderInputIssue[], allowIncomplete: boolean): OrderAddressInput | undefined {
  if (!isRecord(value)) {
    if (allowIncomplete) return { street: "", postalCode: "", city: "" };
    issues.push({ field: prefix, message: "Bitte geben Sie eine vollständige Adresse ein." });
    return undefined;
  }
  const street = text(value, "street", `${prefix}.street`, issues, { required: !allowIncomplete, max: 160 });
  const postalCode = text(value, "postalCode", `${prefix}.postalCode`, issues, { required: !allowIncomplete, max: 16 });
  const city = text(value, "city", `${prefix}.city`, issues, { required: !allowIncomplete, max: 100 });
  const floor = text(value, "floor", `${prefix}.floor`, issues, { max: 80 });
  const runningDistance = text(value, "runningDistance", `${prefix}.runningDistance`, issues, { max: 32 });
  const rawMovementObject = value.movementObject;
  let movementObject: OrderAddressInput["movementObject"];
  if (rawMovementObject !== undefined) {
    if (typeof rawMovementObject === "string" && BUILDING_TYPES.includes(rawMovementObject as typeof BUILDING_TYPES[number])) {
      movementObject = rawMovementObject as NonNullable<OrderAddressInput["movementObject"]>;
    } else issues.push({ field: `${prefix}.movementObject`, message: "Ungültige Objektart." });
  }
  const liftType = text(value, "liftType", `${prefix}.liftType`, issues, { max: 32 });
  if (liftType && !LIFT_TYPES.includes(liftType as typeof LIFT_TYPES[number])) issues.push({ field: `${prefix}.liftType`, message: "Ungültiger Aufzugtyp." });
  const area = text(value, "area", `${prefix}.area`, issues, { max: 16 });
  const roomsNumber = text(value, "roomsNumber", `${prefix}.roomsNumber`, issues, { max: 16 });
  const roomsToRelocate = numeric(value, "roomsToRelocate", `${prefix}.roomsToRelocate`, issues, { max: 100 });
  const kitchenWidth = numeric(value, "kitchenWidth", `${prefix}.kitchenWidth`, issues, { max: 1000 });
  const wardrobeWidth = numeric(value, "wardrobeWidth", `${prefix}.wardrobeWidth`, issues, { max: 1000 });
  const bedNumber = numeric(value, "bedNumber", `${prefix}.bedNumber`, issues, { max: 500 });
  const booleanFields = ["parkingSlot", "isAltbau", "hasLoft", "hasBasement", "hasGarage", "packservice", "demontage", "montage", "bulky"] as const;
  const booleanValues = Object.fromEntries(booleanFields.map((key) => [key, bool(value, key, `${prefix}.${key}`, issues)]));
  const rawFloors = value.stockwerke;
  let stockwerke: string[] | undefined;
  if (rawFloors !== undefined) {
    if (!Array.isArray(rawFloors) || rawFloors.length > 20 || rawFloors.some((entry) => typeof entry !== "string" || entry.length > 40)) {
      issues.push({ field: `${prefix}.stockwerke`, message: "Ungültige Etagenliste." });
    } else stockwerke = rawFloors.map((entry) => (entry as string).trim());
  }
  if (street === undefined || postalCode === undefined || city === undefined) {
    if (allowIncomplete) return { street: street ?? "", postalCode: postalCode ?? "", city: city ?? "" };
    return undefined;
  }
  return {
    street,
    postalCode,
    city,
    ...(floor !== undefined ? { floor } : {}),
    ...(runningDistance !== undefined ? { runningDistance } : {}),
    ...(movementObject !== undefined ? { movementObject } : {}),
    ...(liftType !== undefined ? { liftType } : {}),
    ...(area !== undefined ? { area } : {}),
    ...(roomsNumber !== undefined ? { roomsNumber } : {}),
    ...(roomsToRelocate !== undefined ? { roomsToRelocate } : {}),
    ...(kitchenWidth !== undefined ? { kitchenWidth } : {}),
    ...(wardrobeWidth !== undefined ? { wardrobeWidth } : {}),
    ...(bedNumber !== undefined ? { bedNumber } : {}),
    ...(stockwerke !== undefined ? { stockwerke } : {}),
    ...(booleanValues.parkingSlot !== undefined ? { parkingSlot: booleanValues.parkingSlot } : {}),
    ...(booleanValues.isAltbau !== undefined ? { isAltbau: booleanValues.isAltbau } : {}),
    ...(booleanValues.hasLoft !== undefined ? { hasLoft: booleanValues.hasLoft } : {}),
    ...(booleanValues.hasBasement !== undefined ? { hasBasement: booleanValues.hasBasement } : {}),
    ...(booleanValues.hasGarage !== undefined ? { hasGarage: booleanValues.hasGarage } : {}),
    ...(booleanValues.packservice !== undefined ? { packservice: booleanValues.packservice } : {}),
    ...(booleanValues.demontage !== undefined ? { demontage: booleanValues.demontage } : {}),
    ...(booleanValues.montage !== undefined ? { montage: booleanValues.montage } : {}),
    ...(booleanValues.bulky !== undefined ? { bulky: booleanValues.bulky } : {}),
  };
}

function validDate(value: string, field: string, issues: OrderInputIssue[]) {
  const parsed = DATE_PATTERN.test(value) ? new Date(`${value}T00:00:00.000Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    issues.push({ field, message: "Bitte geben Sie ein gültiges Datum ein." });
  }
}

function validateDetails(value: unknown, issues: OrderInputIssue[], allowStaffPricing: boolean, allowIncomplete: boolean): OrderDetailsInput | undefined {
  if (value === undefined) return undefined;
  if (!isRecord(value)) {
    issues.push({ field: "details", message: "Ungültige Auftragsdetails." });
    return undefined;
  }
  const showSecondaryFrom = bool(value, "showSecondaryFrom", "details.showSecondaryFrom", issues);
  const showSecondaryTo = bool(value, "showSecondaryTo", "details.showSecondaryTo", issues);
  const distanceKm = numeric(value, "distanceKm", "details.distanceKm", issues, { required: true, max: 10000 });
  const secondaryFrom = value.secondaryFrom === undefined ? undefined : validateAddress(value.secondaryFrom, "details.secondaryFrom", issues, allowIncomplete);
  const secondaryTo = value.secondaryTo === undefined ? undefined : validateAddress(value.secondaryTo, "details.secondaryTo", issues, allowIncomplete);

  const rawFurniture = value.furniture;
  const rawExtras = value.extras;
  const rawBasis = value.basis;
  const rawConditions = value.conditions;
  let furniture: OrderDetailsInput["furniture"] | undefined;
  let extras: OrderDetailsInput["extras"] | undefined;
  let basis: OrderDetailsInput["basis"] | undefined;
  let conditions: OrderConditionInput[] | undefined;

  if (!isRecord(rawFurniture)) issues.push({ field: "details.furniture", message: "Ungültige Möbelliste." });
  else {
    const volume = numeric(rawFurniture, "volume", "details.furniture.volume", issues, { required: true, max: 100000 });
    const volumeComplete = bool(rawFurniture, "volumeComplete", "details.furniture.volumeComplete", issues);
    const boxes = numeric(rawFurniture, "boxes", "details.furniture.boxes", issues, { required: true, max: 100000 });
    const wardrobeBoxes = numeric(rawFurniture, "wardrobeBoxes", "details.furniture.wardrobeBoxes", issues, { required: true, max: 100000 });
    const ownItems = text(rawFurniture, "ownItems", "details.furniture.ownItems", issues, { max: 10000 });
    const expensiveText = text(rawFurniture, "expensiveText", "details.furniture.expensiveText", issues, { max: 3000 });
    const heavyText = text(rawFurniture, "heavyText", "details.furniture.heavyText", issues, { max: 3000 });
    const bulkyText = text(rawFurniture, "bulkyText", "details.furniture.bulkyText", issues, { max: 3000 });
    const expensive = bool(rawFurniture, "expensive", "details.furniture.expensive", issues);
    const heavy = bool(rawFurniture, "heavy", "details.furniture.heavy", issues);
    const bulky = bool(rawFurniture, "bulky", "details.furniture.bulky", issues);
    const rawItems = rawFurniture.items;
    const items: OrderFurnitureInput[] = [];
    if (!Array.isArray(rawItems) || rawItems.length > 200) issues.push({ field: "details.furniture.items", message: "Ungültige Möbelliste." });
    else rawItems.forEach((rawItem, index) => {
      if (!isRecord(rawItem)) {
        issues.push({ field: `details.furniture.items.${index}`, message: "Ungültige Möbelposition." });
        return;
      }
      const name = text(rawItem, "name", `details.furniture.items.${index}.name`, issues, { required: true, max: 191 });
      const quantity = numeric(rawItem, "quantity", `details.furniture.items.${index}.quantity`, issues, { required: true, max: 100000 });
      const itemVolume = numeric(rawItem, "volume", `details.furniture.items.${index}.volume`, issues, { max: 100000 });
      const category = text(rawItem, "category", `details.furniture.items.${index}.category`, issues, { max: 191 });
      const catalogId = rawItem.catalogId === undefined ? undefined : numeric(rawItem, "catalogId", `details.furniture.items.${index}.catalogId`, issues, { required: true, max: 2_147_483_647 });
      if (name !== undefined && quantity !== undefined) items.push({
        name,
        quantity,
        ...(itemVolume !== undefined ? { volume: itemVolume } : {}),
        ...(category !== undefined ? { category } : {}),
        ...(catalogId !== undefined ? { catalogId } : {}),
      });
    });
    if (volume !== undefined && boxes !== undefined && wardrobeBoxes !== undefined && ownItems !== undefined && expensiveText !== undefined && heavyText !== undefined && bulkyText !== undefined && expensive !== undefined && heavy !== undefined && bulky !== undefined) {
      furniture = { volume, boxes, wardrobeBoxes, ownItems, items, expensive, expensiveText, heavy, heavyText, bulky, bulkyText,
        ...(volumeComplete !== undefined ? { volumeComplete } : {}),
      };
    }
  }

  if (!isRecord(rawExtras)) issues.push({ field: "details.extras", message: "Ungültige Zusatzleistungen." });
  else {
    const packingRequested = bool(rawExtras, "packingRequested", "details.extras.packingRequested", issues);
    const rawServices = rawExtras.services;
    const services: OrderServiceInput[] = [];
    if (!Array.isArray(rawServices) || rawServices.length > 200) issues.push({ field: "details.extras.services", message: "Ungültige Leistungsliste." });
    else rawServices.forEach((rawService, index) => {
      if (!isRecord(rawService)) {
        issues.push({ field: `details.extras.services.${index}`, message: "Ungültige Leistung." });
        return;
      }
      const name = text(rawService, "name", `details.extras.services.${index}.name`, issues, { required: true, max: 191 });
      const quantity = numeric(rawService, "quantity", `details.extras.services.${index}.quantity`, issues, { required: true, max: 100000 });
      const kind = rawService.kind;
      const catalogId = rawService.catalogId === undefined ? undefined : numeric(rawService, "catalogId", `details.extras.services.${index}.catalogId`, issues, { required: true, max: 2_147_483_647 });
      if (kind !== "packaging" && kind !== "service") issues.push({ field: `details.extras.services.${index}.kind`, message: "Ungültige Leistungsart." });
      if (name !== undefined && quantity !== undefined && (kind === "packaging" || kind === "service")) services.push({ name, quantity, kind, ...(catalogId !== undefined ? { catalogId } : {}) });
    });
    if (packingRequested !== undefined) extras = { packingRequested, services };
  }

  if (!isRecord(rawBasis)) issues.push({ field: "details.basis", message: "Ungültige Angebotsbasis." });
  else {
    const workers = numeric(rawBasis, "workers", "details.basis.workers", issues, { required: true, max: 1000 });
    const trucks = numeric(rawBasis, "trucks", "details.basis.trucks", issues, { required: true, max: 1000 });
    const hours = numeric(rawBasis, "hours", "details.basis.hours", issues, { required: true, max: 10000 });
    const basePrice = numeric(rawBasis, "basePrice", "details.basis.basePrice", issues, { required: true, max: 10_000_000 });
    const extraHourPrice = numeric(rawBasis, "extraHourPrice", "details.basis.extraHourPrice", issues, { required: true, max: 1_000_000 });
    const discountPercent = numeric(rawBasis, "discountPercent", "details.basis.discountPercent", issues, { required: true, max: 100 });
    if (!allowStaffPricing && ((basePrice ?? 0) > 0 || (extraHourPrice ?? 0) > 0 || (discountPercent ?? 0) > 0)) {
      issues.push({ field: "details.basis", message: "Preis- und Rabattangaben sind nur für angemeldete Mitarbeiter verfügbar." });
    }
    if (workers !== undefined && trucks !== undefined && hours !== undefined && basePrice !== undefined && extraHourPrice !== undefined && discountPercent !== undefined) {
      basis = { workers, trucks, hours, basePrice, extraHourPrice, discountPercent };
    }
  }

  if (!Array.isArray(rawConditions) || rawConditions.length > 200) issues.push({ field: "details.conditions", message: "Ungültige Konditionen." });
  else {
    const validatedConditions: OrderConditionInput[] = [];
    rawConditions.forEach((rawCondition, index) => {
      if (!isRecord(rawCondition)) {
        issues.push({ field: `details.conditions.${index}`, message: "Ungültige Kondition." });
        return;
      }
      const description = text(rawCondition, "description", `details.conditions.${index}.description`, issues, { required: true, max: 500 });
      const amount = numeric(rawCondition, "amount", `details.conditions.${index}.amount`, issues, { required: true, max: 10_000_000 });
      if (!allowStaffPricing && (amount ?? 0) > 0) issues.push({ field: `details.conditions.${index}.amount`, message: "Preisangaben sind nur für angemeldete Mitarbeiter verfügbar." });
      if (description !== undefined && amount !== undefined) validatedConditions.push({ description, amount });
    });
    conditions = validatedConditions;
  }

  if (showSecondaryFrom === undefined || showSecondaryTo === undefined || distanceKm === undefined || !furniture || !extras || !basis || !conditions) return undefined;
  if (showSecondaryFrom && !secondaryFrom && !allowIncomplete) issues.push({ field: "details.secondaryFrom", message: "Bitte geben Sie die zweite Beladestelle ein." });
  if (showSecondaryTo && !secondaryTo && !allowIncomplete) issues.push({ field: "details.secondaryTo", message: "Bitte geben Sie die zweite Entladestelle ein." });
  return {
    showSecondaryFrom,
    showSecondaryTo,
    distanceKm,
    furniture,
    extras,
    basis,
    conditions,
    ...(showSecondaryFrom && secondaryFrom ? { secondaryFrom } : {}),
    ...(showSecondaryTo && secondaryTo ? { secondaryTo } : {}),
  };
}

export function validateOrderCreateInput(body: unknown, {
  allowStaffPricing = false,
  allowIncomplete = false,
}: { allowStaffPricing?: boolean; allowIncomplete?: boolean } = {}): OrderInputValidation {
  const issues: OrderInputIssue[] = [];
  if (!isRecord(body)) return { ok: false, issues: [{ field: "body", message: "Ungültige Anfrage." }] };
  const customerValue = body.customer;
  if (!isRecord(customerValue)) return { ok: false, issues: [{ field: "customer", message: "Bitte geben Sie die Kundendaten ein." }] };

  const firstName = text(customerValue, "firstName", "customer.firstName", issues, { required: !allowIncomplete, max: 100 });
  const lastName = text(customerValue, "lastName", "customer.lastName", issues, { required: !allowIncomplete, max: 100 });
  const phone = text(customerValue, "phone", "customer.phone", issues, { required: !allowIncomplete, max: 64 });
  const company = text(customerValue, "company", "customer.company", issues, { max: 160 });
  const email = text(customerValue, "email", "customer.email", issues, { max: 254 });
  const rawSalutation = customerValue.salutation;
  let salutation: CreateOrderInput["customer"]["salutation"];
  if (rawSalutation !== undefined) {
    if (rawSalutation === "Herr" || rawSalutation === "Frau" || rawSalutation === "Divers" || rawSalutation === "") salutation = rawSalutation;
    else issues.push({ field: "customer.salutation", message: "Ungültige Anrede." });
  }

  if (email && !EMAIL_PATTERN.test(email)) issues.push({ field: "customer.email", message: "Bitte geben Sie eine gültige E-Mail-Adresse ein." });
  if (phone && !/[0-9]{3}/u.test(phone)) issues.push({ field: "customer.phone", message: "Bitte geben Sie eine gültige Telefonnummer ein." });

  const from = validateAddress(body.from, "from", issues, allowIncomplete);
  const to = validateAddress(body.to, "to", issues, allowIncomplete);
  const movingDate = text(body, "movingDate", "movingDate", issues, { required: !allowIncomplete, max: 10 });
  const movingTime = text(body, "movingTime", "movingTime", issues, { max: 5 });
  const dateFrom = text(body, "dateFrom", "dateFrom", issues, { max: 10 });
  const dateTo = text(body, "dateTo", "dateTo", issues, { max: 10 });
  const dateFixed = bool(body, "dateFixed", "dateFixed", issues);
  const rawOrderSource = body.orderSource;
  let orderSource: CreateOrderInput["orderSource"];
  if (rawOrderSource !== undefined) {
    if (typeof rawOrderSource === "string" && ORDER_SOURCES.includes(rawOrderSource as typeof ORDER_SOURCES[number])) orderSource = rawOrderSource as NonNullable<CreateOrderInput["orderSource"]>;
    else issues.push({ field: "orderSource", message: "Ungültige Auftragsquelle." });
  }
  const note = text(body, "note", "note", issues, { max: 5000 });
  const costsAssumption = bool(body, "costsAssumption", "costsAssumption", issues);
  const details = validateDetails(body.details, issues, allowStaffPricing, allowIncomplete);
  const privacyAccepted = bool(body, "privacyAccepted", "privacyAccepted", issues);
  const visitWanted = bool(body, "visitWanted", "visitWanted", issues);
  let imageClaims: CreateOrderInput["imageClaims"];
  if (body.imageClaims !== undefined) {
    if (!Array.isArray(body.imageClaims) || body.imageClaims.some((claim) => !isRecord(claim)
      || typeof claim.id !== "string" || !/^[a-f0-9-]{36}$/.test(claim.id)
      || typeof claim.token !== "string" || !/^[A-Za-z0-9_-]{43}$/.test(claim.token))) {
      issues.push({ field: "imageClaims", message: "Ungültige Bildreferenzen." });
    } else {
      imageClaims = body.imageClaims.map((claim: { id: string; token: string }) => ({ id: claim.id, token: claim.token }));
      if (new Set(imageClaims.map((claim) => claim.id)).size !== imageClaims.length) issues.push({ field: "imageClaims", message: "Doppelte Bildreferenzen." });
    }
  }

  if (movingDate) validDate(movingDate, "movingDate", issues);
  if (dateFrom) validDate(dateFrom, "dateFrom", issues);
  if (dateTo) validDate(dateTo, "dateTo", issues);
  if (dateFrom && dateTo && dateFrom > dateTo) issues.push({ field: "dateTo", message: "Das Bis-Datum muss nach dem Von-Datum liegen." });
  if (movingTime && (!TIME_PATTERN.test(movingTime) || Number(movingTime.slice(0, 2)) > 23 || Number(movingTime.slice(3, 5)) > 59)) {
    issues.push({ field: "movingTime", message: "Bitte geben Sie eine gültige Uhrzeit ein." });
  }

  const normalizedFirstName = firstName ?? (allowIncomplete ? "" : undefined);
  const normalizedLastName = lastName ?? (allowIncomplete ? "" : undefined);
  const normalizedPhone = phone ?? (allowIncomplete ? "" : undefined);
  const normalizedMovingDate = movingDate ?? (allowIncomplete ? "" : undefined);
  if (issues.length > 0 || normalizedFirstName === undefined || normalizedLastName === undefined || normalizedPhone === undefined || from === undefined || to === undefined || normalizedMovingDate === undefined) {
    return { ok: false, issues };
  }
  return {
    ok: true,
    value: {
      customer: {
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        phone: normalizedPhone,
        ...(company !== undefined ? { company } : {}),
        ...(email !== undefined ? { email } : {}),
        ...(salutation !== undefined ? { salutation } : {}),
      },
      from,
      to,
      movingDate: normalizedMovingDate,
      ...(privacyAccepted !== undefined ? { privacyAccepted } : {}),
      ...(visitWanted !== undefined ? { visitWanted } : {}),
      ...(imageClaims !== undefined ? { imageClaims } : {}),
      ...(movingTime !== undefined ? { movingTime } : {}),
      ...(dateFrom !== undefined ? { dateFrom } : {}),
      ...(dateTo !== undefined ? { dateTo } : {}),
      ...(dateFixed !== undefined ? { dateFixed } : {}),
      ...(orderSource !== undefined ? { orderSource } : {}),
      ...(note !== undefined ? { note } : {}),
      ...(costsAssumption !== undefined ? { costsAssumption } : {}),
      ...(details !== undefined ? { details } : {}),
    },
  };
}

export function validateCustomerFormInput(input: CreateOrderInput): OrderInputIssue[] {
  const issues: OrderInputIssue[] = [];
  if (!input.customer.email) issues.push({ field: "customer.email", message: "Die E-Mail-Adresse ist erforderlich." });
  if (input.privacyAccepted !== true) issues.push({ field: "privacyAccepted", message: "Bitte bestätigen Sie die Datenschutzerklärung." });
  if (typeof input.dateFixed !== "boolean" || (input.dateFixed === false && (!input.dateFrom || !input.dateTo))) {
    issues.push({ field: "dateFixed", message: "Bitte geben Sie den festen Termin oder den vollständigen Zeitraum ein." });
  }
  if (!input.details) issues.push({ field: "details", message: "Die Angaben zu Umzugsgut und Leistungen fehlen." });
  for (const key of ["from", "to"] as const) {
    const address = input[key];
    if (!/.{1,50}\d.{0,5}/u.test(address.street)) issues.push({ field: `${key}.street`, message: "Straße und Hausnummer sind unvollständig." });
    if (!address.movementObject || !BUILDING_TYPES.includes(address.movementObject)) issues.push({ field: `${key}.movementObject`, message: "Bitte wählen Sie die Objektart." });
    if (!/^(?:10|20|30|40|50|60|70|80|90|100) m\.$/u.test(address.runningDistance ?? "")) issues.push({ field: `${key}.runningDistance`, message: "Bitte wählen Sie die Entfernung vom Parkplatz." });
    if (address.movementObject !== "Haus") {
      if (!/^(?:UG|EG|[1-8]\. Etage|9\+ Etage)$/u.test(address.floor ?? "")) issues.push({ field: `${key}.floor`, message: "Bitte wählen Sie das Stockwerk." });
      if (!address.liftType || !LIFT_TYPES.includes(address.liftType as typeof LIFT_TYPES[number])) issues.push({ field: `${key}.liftType`, message: "Bitte wählen Sie den Fahrstuhl." });
    } else if (address.stockwerke?.some((floor) => !["UG", "EG", "1.OG", "2.OG"].includes(floor))) {
      issues.push({ field: `${key}.stockwerke`, message: "Ungültige Stockwerke." });
    }
  }
  if (!input.from.roomsNumber || !Number.isFinite(Number(input.from.roomsNumber)) || Number(input.from.roomsNumber) <= 0 || Number(input.from.roomsNumber) > 100) {
    issues.push({ field: "from.roomsNumber", message: "Bitte geben Sie eine Zimmeranzahl zwischen 1 und 100 ein." });
  }
  if (!/^(?:[1-9]0|1[0-5]0) m²$/u.test(input.from.area ?? "")) issues.push({ field: "from.area", message: "Bitte wählen Sie die Wohnfläche." });
  if (input.details?.furniture.items.some((item) => item.catalogId === undefined)
    || input.details?.extras.services.some((item) => item.catalogId === undefined)) {
    issues.push({ field: "details", message: "Bitte verwenden Sie ausschließlich freigegebene Katalogpositionen." });
  }
  return issues;
}
