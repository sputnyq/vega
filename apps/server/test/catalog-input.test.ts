import assert from "node:assert/strict";
import test from "node:test";
import {
  validateCategoryInput,
  validateFurnitureInput,
  validateOfferInput,
  validatePackingInput,
  validateServiceInput,
  validateServiceRateInput,
} from "../src/catalog/catalog-input.js";

test("catalog category names and sorting are validated and only approved fields are returned", () => {
  const result = validateCategoryInput({ name: "Wohnzimmer", sort: 3, legacyField: "ignored" });
  assert.deepEqual(result, { ok: true, value: { name: "Wohnzimmer", sort: 3 } });
  assert.equal(validateCategoryInput({ name: " ", sort: -1 }).ok, false);
});

test("furniture rejects malformed category references, negative measures, and bad prices", () => {
  const result = validateFurnitureInput({
    name: "Sofa",
    categoryIds: [2, "3"],
    volume: -1,
    step: null,
    sortOrder: 0,
    weight: "",
    montagePrice: 5.555,
    extraPrice: 0,
    demontage: false,
    notDismountable: false,
    bulky: false,
    montage: true,
    m100: false,
    m150: false,
  });
  assert.equal(result.ok, false);
});

test("service and packing data validate customer-visible prices and safe media URLs", () => {
  assert.equal(validateServiceInput({ name: "Bohrarbeiten", price: 12.5, sort: 1, show: true }).ok, true);
  assert.equal(validateServiceInput({ name: "Bohrarbeiten", price: -1, sort: 1, show: true }).ok, false);
  assert.equal(validatePackingInput({ name: "Karton", price: 2.5, description: "Doppelwellig", media: "https://assets.example.test/box.png", sort: 1, show: true }).ok, true);
  assert.equal(validatePackingInput({ name: "Karton", price: 2.5, description: "", media: "javascript:alert(1)", sort: 1, show: true }).ok, false);
});

test("offers validate bounded workforce and prices; service rates only accept allowlisted keys", () => {
  assert.equal(validateOfferInput({ name: "3 Träger · 1 LKW", workers: 3, trucks: 1, includedHours: 4, sum: 850, hourPrice: 120, ridingCosts: 20, sort: 0 }).ok, true);
  assert.equal(validateOfferInput({ name: "Bad offer", workers: 0, trucks: 1, includedHours: 4, sum: 850, hourPrice: 120, ridingCosts: 20, sort: 0 }).ok, false);
  assert.equal(validateServiceRateInput("kmPrice", { price: 2.5 }).ok, true);
  assert.equal(validateServiceRateInput("databaseUrl", { price: 2.5 }).ok, false);
  assert.equal(validateServiceRateInput("hvzPrice", { price: -2 }).ok, false);
});
