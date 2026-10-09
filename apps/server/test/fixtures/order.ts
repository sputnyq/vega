import type { CreateOrderInput } from "@vega/domain";

export function orderFixture(): CreateOrderInput {
  return {
    customer: { firstName: "Test", lastName: "Kunde", phone: "089123456", email: "customer@example.test" },
    from: { street: "Teststrasse 1", postalCode: "80331", city: "Muenchen", floor: "EG", parkingSlot: true },
    to: { street: "Teststrasse 2", postalCode: "80333", city: "Muenchen", parkingSlot: false },
    movingDate: "2026-11-15",
    details: {
      secondaryFrom: { street: "Testlager 3", postalCode: "80335", city: "Muenchen" },
      secondaryTo: { street: "Testlager 4", postalCode: "80336", city: "Muenchen" },
      showSecondaryFrom: true, showSecondaryTo: true, distanceKm: 10,
      furniture: {
        volume: 5, boxes: 2, wardrobeBoxes: 1, ownItems: "",
        items: [{ name: "Testsofa", quantity: 1.5, volume: 2.5, category: "Wohnen" }],
        expensive: false, expensiveText: "", heavy: false, heavyText: "", bulky: false, bulkyText: "",
      },
      extras: {
        packingRequested: true,
        services: [
          { name: "Testservice", kind: "service", quantity: 2 },
          { name: "Testkarton", kind: "packaging", quantity: 3 },
          { name: "Weiterer Testservice", kind: "service", quantity: 1 },
        ],
      },
      basis: { workers: 2, trucks: 1, hours: 3, basePrice: 100, extraHourPrice: 20, discountPercent: 0 },
      conditions: [],
    },
  };
}
