import assert from "node:assert/strict";
import test from "node:test";
import { validateOrderCreateInput } from "../src/orders/order-input.js";

const validOrder = {
  customer: {
    firstName: "Ada",
    lastName: "Beispiel",
    phone: "+49 89 123456",
    email: "ada@example.test",
    unexpected: "must not be retained",
  },
  from: { street: "Altstraße 1", postalCode: "80331", city: "München" },
  to: { street: "Neustraße 2", postalCode: "80333", city: "München" },
  movingDate: "2026-11-15",
  movingTime: "07:30",
  note: "Bitte vorher anrufen.",
  price: 0.01,
};

test("validates order submission and strips fields outside the approved input contract", () => {
  const result = validateOrderCreateInput(validOrder);
  assert.equal(result.ok, true);
  if (!result.ok) return;
  assert.equal("price" in result.value, false);
  assert.equal("unexpected" in result.value.customer, false);
  assert.deepEqual(result.value.from, validOrder.from);
});

test("rejects missing contact/address data, invalid email, and impossible dates", () => {
  const result = validateOrderCreateInput({
    ...validOrder,
    customer: { ...validOrder.customer, firstName: "", email: "nope" },
    from: { street: "", postalCode: "", city: "" },
    movingDate: "2026-02-31",
  });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((issue) => issue.field === "customer.firstName"));
  assert.ok(result.issues.some((issue) => issue.field === "customer.email"));
  assert.ok(result.issues.some((issue) => issue.field === "from.street"));
  assert.ok(result.issues.some((issue) => issue.field === "movingDate"));
});

test("rejects malformed and oversized payload sections", () => {
  const result = validateOrderCreateInput({ ...validOrder, note: "x".repeat(5001) });
  assert.equal(result.ok, false);
  if (result.ok) return;
  assert.ok(result.issues.some((issue) => issue.field === "note"));
  assert.equal(validateOrderCreateInput(null).ok, false);
});

test("validates and persists secondary addresses while keeping prices staff-only", () => {
  const details = {
    showSecondaryFrom: true,
    showSecondaryTo: true,
    secondaryFrom: { street: "Weitere Straße 3", postalCode: "80335", city: "München" },
    secondaryTo: { street: "Zweite Zielstraße 4", postalCode: "80336", city: "München" },
    distanceKm: 17,
    furniture: {
      volume: 30,
      boxes: 12,
      wardrobeBoxes: 2,
      ownItems: "",
      items: [{ name: "Sofa", quantity: 1, volume: 3 }],
      expensive: false,
      expensiveText: "",
      heavy: false,
      heavyText: "",
      bulky: false,
      bulkyText: "",
    },
    extras: { packingRequested: false, services: [] },
    basis: { workers: 3, trucks: 1, hours: 4, basePrice: 0, extraHourPrice: 0, discountPercent: 0 },
    conditions: [],
  };
  const publicResult = validateOrderCreateInput({ ...validOrder, details });
  assert.equal(publicResult.ok, true);
  if (publicResult.ok) {
    assert.equal(publicResult.value.details?.secondaryFrom?.street, "Weitere Straße 3");
    assert.equal(publicResult.value.details?.secondaryTo?.street, "Zweite Zielstraße 4");
  }

  const pricedDetails = { ...details, basis: { ...details.basis, basePrice: 800 } };
  assert.equal(validateOrderCreateInput({ ...validOrder, details: pricedDetails }).ok, false);
  assert.equal(validateOrderCreateInput({ ...validOrder, details: pricedDetails }, { allowStaffPricing: true }).ok, true);
});

test("allows a staff draft with empty legacy fields but still requires public submissions to be complete", () => {
  const draft = {
    customer: { firstName: "", lastName: "", phone: "" },
    from: { street: "", postalCode: "", city: "" },
    to: { street: "", postalCode: "", city: "" },
    movingDate: "",
  };
  const staffResult = validateOrderCreateInput(draft, { allowIncomplete: true, allowStaffPricing: true });
  assert.equal(staffResult.ok, true);
  if (staffResult.ok) assert.equal(staffResult.value.customer.firstName, "");
  assert.equal(validateOrderCreateInput(draft).ok, false);
});
