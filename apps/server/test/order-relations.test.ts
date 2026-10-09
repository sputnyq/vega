import assert from "node:assert/strict";
import test from "node:test";
import { orderRelationCreates } from "../src/orders/order-relations.js";
import { orderFixture } from "./fixtures/order.js";

test("relational projection keeps optional addresses, mixed position order and independent row identities", () => {
  const input = orderFixture();
  const first = orderRelationCreates(input);
  const copy = orderRelationCreates(input);
  assert.deepEqual(first.addresses.create.map((row) => row.role), ["FROM", "TO", "SECONDARY_FROM", "SECONDARY_TO"]);
  assert.deepEqual(first.addresses.create[0]?.details, { floor: "EG", parkingSlot: true });
  assert.deepEqual(first.positions.create.map((row) => [row.kind, row.position]), [
    ["FURNITURE", 0], ["SERVICE", 0], ["PACKAGING", 1], ["SERVICE", 2],
  ]);
  assert.equal(first.positions.create[0]?.quantity, 1.5);
  assert.notEqual(first.addresses.create[0]?.id, copy.addresses.create[0]?.id);
  assert.notEqual(first.positions.create[0]?.id, copy.positions.create[0]?.id);
});

test("incomplete staff drafts still create the two required address rows and no positions", () => {
  const rows = orderRelationCreates({
    customer: { firstName: "", lastName: "", phone: "" },
    from: { street: "", postalCode: "", city: "" },
    to: { street: "", postalCode: "", city: "" }, movingDate: "",
  });
  assert.equal(rows.addresses.create.length, 2);
  assert.equal(rows.addresses.create[0]?.street, "");
  assert.deepEqual(rows.positions.create, []);
});
