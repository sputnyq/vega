import assert from "node:assert/strict";
import test from "node:test";
import {
  calculateOrderPricing,
  calculateRoundedPercent,
  roundAmountToCents,
  roundAmountToNearestIncrement,
  OrderPricingError,
} from "@vega/domain";
import { validateOrderCreateInput } from "../src/orders/order-input.js";
import { orderFixture } from "./fixtures/order.js";

const offer = {
  id: 7, name: "3 Träger / 2 LKW", workers: 3, trucks: 2, includedHours: 4,
  sum: 1_000, hourPrice: 80, ridingCosts: 100, sort: 0,
};
const rates = [{ key: "kmPrice" as const, price: 1.25 }, { key: "hvzPrice" as const, price: 120 }];

function pricingInput(overrides: Partial<Parameters<typeof calculateOrderPricing>[0]> = {}) {
  return {
    addresses: [{ street: "A", postalCode: "80331", city: "Berlin", parkingSlot: true }, { street: "B", postalCode: "80333", city: "Berlin", parkingSlot: true }],
    basis: { workers: 3, trucks: 2, hours: 4, basePrice: 1_000, extraHourPrice: 80, discountPercent: 10, offerId: 7 },
    distanceKm: 101.4,
    services: [
      { kind: "service" as const, catalogId: 9, name: "Bohrarbeiten", quantity: 2, price: 35.5 },
      { kind: "packaging" as const, catalogId: 10, name: "Umzugskarton", quantity: 10, price: 2.5 },
    ],
    offer,
    rates,
    calculatedAt: "2026-10-16T10:00:00.000Z",
    ...overrides,
  };
}

test("calculates gross conditions from the selected tariff and current catalog", () => {
  const result = calculateOrderPricing(pricingInput());
  assert.deepEqual(result.conditions, [
    { description: "3 Träger / 2 LKW", amount: 1_000, kind: "base" },
    { description: "Rabatt 10%", amount: -100, kind: "discount" },
    { description: "An-/Abfahrtskosten", amount: 255, kind: "travel" },
    { description: "Organisation von 2 Halteverbotszone(n)", amount: 240, kind: "parking" },
    { description: "Leistungen", amount: 71, kind: "services" },
    { description: "Verpackung (wird nach Verbrauch berechnet)", amount: 25, kind: "packaging" },
  ]);
  assert.equal(result.conditions.reduce((sum, condition) => sum + condition.amount, 0), 1_491);
  assert.equal(result.pricingSnapshot.offer?.id, 7);
  assert.equal(result.pricingSnapshot.services.length, 2);
});

test("uses exact cent rounding for discounts and nearest-five rounding for kilometers", () => {
  assert.equal(calculateRoundedPercent(123.45, 10), 12.35);
  assert.equal(roundAmountToCents(1.005), 1.01);
  assert.equal(roundAmountToNearestIncrement(252.49, 5), 250);
  assert.equal(roundAmountToNearestIncrement(252.5, 5), 255);
});

test("rejects derived condition amounts outside the order input limit", () => {
  assert.throws(
    () => calculateOrderPricing(pricingInput({
      services: [{ kind: "service", catalogId: 9, name: "Leistung", quantity: 2, price: 10_000_000 }],
    })),
    (error: unknown) => error instanceof OrderPricingError && error.message === "PRICE_LIMIT_EXCEEDED",
  );
});

test("uses the tariff riding cost as the minimum and local rides do not require distance", () => {
  const longDistance = calculateOrderPricing(pricingInput({ distanceKm: 0.1 }));
  assert.equal(longDistance.conditions.find((condition) => condition.kind === "travel")?.amount, 100);

  const local = calculateOrderPricing(pricingInput({
    distanceKm: 0,
    addresses: [{ street: "A", postalCode: "80331", city: "Muenchen" }],
  }));
  assert.equal(local.conditions.find((condition) => condition.kind === "travel")?.amount, 100);
});

test("requires distance and matching tariff for non-local priced routes", () => {
  assert.throws(
    () => calculateOrderPricing(pricingInput({
      addresses: [{ street: "A", postalCode: "10115", city: "Berlin" }],
      distanceKm: 0,
    })),
    (error: unknown) => error instanceof OrderPricingError && error.message === "DISTANCE_REQUIRED",
  );
  assert.throws(
    () => calculateOrderPricing(pricingInput({ basis: { ...pricingInput().basis, workers: 2 } })),
    (error: unknown) => error instanceof Error && error.message === "OFFER_MISMATCH",
  );
  const { offerId: _offerId, ...manualBasis } = pricingInput().basis;
  assert.throws(
    () => calculateOrderPricing(pricingInput({
      addresses: [{ street: "A", postalCode: "80331", city: "München" }],
      basis: manualBasis,
      offer: null,
    })),
    (error: unknown) => error instanceof OrderPricingError && error.message === "PRICE_NOT_CONFIGURED",
  );
});

test("accepts typed discount conditions for staff but not in anonymous requests", () => {
  const staff = orderFixture();
  staff.details!.conditions = [
    { description: "Basis", amount: 100, kind: "base" },
    { description: "Rabatt 10%", amount: -10, kind: "discount" },
  ];
  assert.equal(validateOrderCreateInput(staff, { allowStaffPricing: true }).ok, true);
  assert.equal(validateOrderCreateInput(staff).ok, false);

  staff.details!.conditions = [{ description: "Manuelle Gutschrift", amount: -10 }];
  assert.equal(validateOrderCreateInput(staff, { allowStaffPricing: true }).ok, false);
});

test("pricing snapshots are staff-only and survive validated order reads", () => {
  const input = orderFixture();
  const { offerId: _offerId, ...manualBasis } = pricingInput().basis;
  manualBasis.trucks = 0;
  const { from, to } = input;
  const calculated = calculateOrderPricing(pricingInput({
    addresses: [{ ...from, city: "München" }, { ...to, city: "München" }],
    basis: manualBasis,
    services: [],
    offer: null,
    rates: [{ key: "kmPrice", price: 0 }, { key: "hvzPrice", price: 0 }],
  }));
  input.pricingSnapshot = calculated.pricingSnapshot;
  const staff = validateOrderCreateInput(input, { allowStaffPricing: true });
  assert.equal(staff.ok, true);
  if (staff.ok) assert.deepEqual(staff.value.pricingSnapshot, calculated.pricingSnapshot);
  assert.equal(validateOrderCreateInput(input).ok, false);
});
