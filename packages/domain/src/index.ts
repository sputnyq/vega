export { meetsPasswordPolicy, PASSWORD_MAX_LENGTH, PASSWORD_MIN_LENGTH } from "./password-policy.js";

/** Anwendungsrollen; Berechtigungen werden serverseitig durchgesetzt. */
export type UserRole = "Admin" | "Kundenberater";

export interface StaffAccountDto {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  blocked: boolean;
  mustChangePassword: boolean;
  twoFactorEnabled: boolean | null;
  createdAt: string;
}

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
    volumeComplete?: boolean;
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
  privacyAccepted?: boolean;
  visitWanted?: boolean;
  imageClaims?: Array<{ id: string; token: string }>;
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

export interface CustomerFormConfig {
  privacyUrl: string | null;
  boxCalculatorUrl: string | null;
  successUrl: string | null;
  boxVolume: number | null;
  wardrobeBoxVolume: number | null;
  uploadsAvailable: boolean;
  placesAvailable: boolean;
}

export interface AppSettingsDto {
  revision: number;
  boxCbm: number | null;
  kleiderboxCbm: number | null;
  origin: string | null;
  dataPrivacyUrl: string | null;
  successUrl: string | null;
  boxCalculatorUrl: string | null;
  companyEmail: string | null;
  emailFromName: string | null;
  emailFromAddress: string | null;
}
export type AppSettingsInput = Omit<AppSettingsDto, "revision">;

/** Staff-only order representation. Never expose this DTO from public routes. */
export interface AdminOrderListItem {
  orderNumber: number;
  source: string;
  customerName: string;
  movingDate: string;
  fromAddress: string;
  fromParkingSlot: boolean;
  toAddress: string;
  toParkingSlot: boolean;
  workers: number | null;
  trucks: number | null;
  hours: number | null;
  createdAt: string;
  editedAt: string | null;
  isCopy: boolean;
  archivedAt: string | null;
}

export interface AdminOrderDetail extends AdminOrderListItem {
  data: CreateOrderInput;
  originOrderId: string | null;
}

/** Minimal audit projection; deliberately excludes field-level before/after values. */
export interface AdminOrderJournalEntry {
  id: string;
  action: string;
  actorName: string;
  occurredAt: string;
}

export interface InvoiceEntryInput {
  description: string;
  quantity: number;
  unitPrice: number;
}

export interface InvoiceDueDateInput {
  date: string;
  amount: number;
  text: string;
}

export interface InvoiceInput {
  invoiceNumber?: string;
  invoiceDate: string;
  company: string;
  customerName: string;
  customerStreet: string;
  customerPostalCity: string;
  taxPercent: number;
  text: string;
  entries: InvoiceEntryInput[];
  dueDates: InvoiceDueDateInput[];
}

export interface AdminInvoiceDto extends InvoiceInput {
  id: string;
  invoiceNumber: string;
  orderNumber: number | null;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
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
