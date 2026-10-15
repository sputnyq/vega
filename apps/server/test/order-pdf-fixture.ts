import { SERVICE_RATE_KEYS } from "@vega/domain";
import type { OrderPdfInput } from "../src/pdf/order-pdf.js";

export function orderPdfFixture(): OrderPdfInput {
  return {
    orderNumber: 1042,
    data: {
      customer: { company: "Beispiel GmbH", salutation: "Frau", firstName: "Ada", lastName: "Beispiel", phone: "089 123456" },
      movingDate: "2026-10-24", movingTime: "08:30", orderSource: "check24",
      note: "Bitte zuerst die Möbel im Wohnzimmer verladen.",
      from: { street: "Beispielstraße 1", postalCode: "80331", city: "München", movementObject: "Wohnung", floor: "2", liftType: "4 Personen", runningDistance: "10 m", parkingSlot: true, demontage: true, kitchenWidth: 3, wardrobeWidth: 2, bedNumber: 1, hasBasement: true },
      to: { street: "Musterstraße 2", postalCode: "80999", city: "München", movementObject: "Haus", stockwerke: ["EG", "1"], hasGarage: true, montage: true },
      details: {
        showSecondaryFrom: true, showSecondaryTo: true, distanceKm: 12,
        secondaryFrom: { street: "Lagerstraße 3", postalCode: "80331", city: "München", movementObject: "Lager", floor: "EG" },
        secondaryTo: { street: "Bürostraße 4", postalCode: "80999", city: "München", movementObject: "Büro", floor: "3" },
        basis: { workers: 3, trucks: 2, hours: 4, basePrice: 0, extraHourPrice: 150, discountPercent: 0 },
        conditions: [{ description: "Umzug inklusive Anfahrt", amount: 1190 }, { description: "Halteverbot", amount: 119 }],
        extras: { packingRequested: true, services: [{ name: "Bohren", quantity: 2, catalogId: 1, kind: "service" }, { name: "Umzugskarton", quantity: 5, catalogId: 1, kind: "packaging" }] },
        furniture: {
          volume: 25, boxes: 15, wardrobeBoxes: 2, ownItems: "",
          expensive: false, expensiveText: "", heavy: false, heavyText: "", bulky: false, bulkyText: "",
          items: [{ name: "Sofa", quantity: 1, category: "Wohnzimmer" }, { name: "Bett", quantity: 2, category: "Schlafzimmer" }],
        },
      },
    },
    services: [
      { id: 1, name: "Bohren", price: 20, sort: 1, kind: "service" },
      { id: 2, name: "Lampen montieren", price: 15, sort: 2, kind: "service" },
      { id: 1, name: "Umzugskarton", price: 3, sort: 1, kind: "packaging" },
    ],
    rates: SERVICE_RATE_KEYS.map((key, index) => ({ key, price: (index + 1) * 10 })),
  };
}
