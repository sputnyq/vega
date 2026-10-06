/** Anwendungsrollen; Berechtigungen werden serverseitig durchgesetzt. */
export type UserRole = "Admin" | "Kundenberater";

/** Minimaler öffentlicher Statusvertrag des Express-Healthchecks. */
export interface HealthStatus {
  status: "ok";
  service: "vega";
}

export interface OrderAddressInput {
  street: string;
  postalCode: string;
  city: string;
  floor?: string;
  runningDistance?: string;
  parkingSlot?: boolean;
  movementObject?: "Wohnung" | "Haus" | "Keller" | "Lager" | "Büro";
  liftType?: string;
  isAltbau?: boolean;
  hasLoft?: boolean;
  hasBasement?: boolean;
  hasGarage?: boolean;
  area?: string;
  roomsNumber?: string;
  roomsToRelocate?: number;
  packservice?: boolean;
  demontage?: boolean;
  montage?: boolean;
  stockwerke?: string[];
  kitchenWidth?: number;
  wardrobeWidth?: number;
  bedNumber?: number;
  bulky?: boolean;
}

export interface OrderFurnitureInput {
  name: string;
  quantity: number;
  volume?: number;
  category?: string;
  catalogId?: number;
}

export interface OrderServiceInput {
  name: string;
  quantity: number;
  kind: "packaging" | "service";
  catalogId?: number;
}

export interface OrderConditionInput {
  description: string;
  amount: number;
}

export interface OrderDetailsInput {
  secondaryFrom?: OrderAddressInput;
  secondaryTo?: OrderAddressInput;
  showSecondaryFrom: boolean;
  showSecondaryTo: boolean;
  distanceKm: number;
  furniture: {
    volume: number;
    boxes: number;
    wardrobeBoxes: number;
    ownItems: string;
    items: OrderFurnitureInput[];
    expensive: boolean;
    expensiveText: string;
    heavy: boolean;
    heavyText: string;
    bulky: boolean;
    bulkyText: string;
  };
  extras: {
    packingRequested: boolean;
    services: OrderServiceInput[];
  };
  basis: {
    workers: number;
    trucks: number;
    hours: number;
    basePrice: number;
    extraHourPrice: number;
    discountPercent: number;
  };
  conditions: OrderConditionInput[];
}

/** Customer-submitted or staff-entered order data. Prices are deliberately absent. */
export interface CreateOrderInput {
  customer: {
    company?: string;
    salutation?: "Herr" | "Frau" | "Divers" | "";
    firstName: string;
    lastName: string;
    email?: string;
    phone: string;
  };
  from: OrderAddressInput;
  to: OrderAddressInput;
  details?: OrderDetailsInput;
  movingDate: string;
  movingTime?: string;
  dateFrom?: string;
  dateTo?: string;
  dateFixed?: boolean;
  orderSource?: "express" | "individuelle" | "Moebelliste" | "UmzugRuckZuck" | "check24" | "umzugruckzuck24.de";
  note?: string;
  costsAssumption?: boolean;
}

export interface CreateOrderResult {
  orderNumber: number;
}

export interface CatalogCategoryDto {
  id: number;
  name: string;
  sort: number;
}

export interface CatalogFurnitureDto {
  id: number;
  name: string;
  categoryIds: number[];
  categoryRefs: Array<Pick<CatalogCategoryDto, "id" | "name">>;
  volume: number;
  step: number | null;
  sortOrder: number;
  weight: string | null;
  montagePrice: number;
  extraPrice: number;
  demontage: boolean;
  notDismountable: boolean;
  bulky: boolean;
  montage: boolean;
  m100: boolean;
  m150: boolean;
}

export interface CatalogServiceDto {
  id: number;
  name: string;
  price: number;
  sort: number;
  show: boolean;
}

export interface CatalogPackingDto {
  id: number;
  name: string;
  price: number;
  description: string;
  media: string | null;
  sort: number;
  show: boolean;
}

export interface CatalogOfferDto {
  id: number;
  name: string;
  workers: number;
  trucks: number;
  includedHours: number;
  sum: number;
  hourPrice: number;
  ridingCosts: number;
  sort: number;
}

export const SERVICE_RATE_KEYS = [
  "aBettDeMon",
  "aBoxPack",
  "acbm",
  "aetage",
  "akitmon",
  "ameter",
  "awardmon",
  "disposalBasicPrice",
  "disposalCbmPrice",
  "kmPrice",
  "hvzPrice",
] as const;

export type ServiceRateKey = typeof SERVICE_RATE_KEYS[number];

export interface CatalogServiceRateDto {
  key: ServiceRateKey;
  price: number;
}

export type CatalogCategoryInput = Pick<CatalogCategoryDto, "name" | "sort">;

export type CatalogFurnitureInput = Omit<CatalogFurnitureDto, "id" | "categoryRefs">;

export type CatalogServiceInput = Omit<CatalogServiceDto, "id">;

export type CatalogPackingInput = Omit<CatalogPackingDto, "id">;

export type CatalogOfferInput = Omit<CatalogOfferDto, "id">;
