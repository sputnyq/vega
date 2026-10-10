import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { generateOrderPdf, orderPdfFilename } from "../src/pdf/order-pdf.js";
import { orderPdfFixture } from "./order-pdf-fixture.js";

const now = new Date("2026-10-10T10:00:00Z");
const streams = (pdf: Buffer) => [...pdf.toString("latin1").matchAll(/stream\n([\s\S]*?)\nendstream/g)].map((match) => match[1]!);

test("order PDF matches the original OrderPdf.ts page drawing streams exactly", () => {
  const pdf = generateOrderPdf(orderPdfFixture(), now);
  assert.equal(pdf.subarray(0, 4).toString("ascii"), "%PDF");
  const pageCount = pdf.toString("latin1").match(/\/Type \/Page\b/g)?.length;
  assert.equal(pageCount, 4);
  // Captured from the original jsPDF 4.2.1 / autotable 5.0.8 template with the same synthetic fixture.
  assert.deepEqual(streams(pdf).slice(0, pageCount).map((stream) => createHash("sha256").update(stream).digest("hex")), [
    "1745cfeadb48118d1ffe83fbd6ed033599717ec35b35bb9ef8d63ae696c40de8",
    "29aa91cb070f108d36d5c4415fd8c20283b36325e0a6aa8208491384a21b286b",
    "e2c0a2a0b0ab072a7a7a090304cbcf92032923d5711a75fb47fc222a3ab15d03",
    "c560469113a9e3e468d08e9606214b0cd5cc86eb6a783f08865e2d56e198d487",
  ]);
  assert.equal(orderPdfFilename(orderPdfFixture()), "24.10.2026_Beispiel_1042_3+2x3.5_4_Std_1xHVZ.pdf");
});

test("PDF handles incomplete saved drafts without invalid dates or invented data", () => {
  const input = orderPdfFixture();
  input.data.movingDate = "";
  input.data.customer.lastName = "";
  delete input.data.details;
  const pdf = generateOrderPdf(input, now);
  assert.ok(pdf.length > 1000);
  assert.ok(!pdf.toString("latin1").includes("NaN"));
  assert.ok(!pdf.toString("latin1").includes("undefined"));
  assert.equal(orderPdfFilename(input), "_Auftrag_1042_1xHVZ.pdf");
});

test("saved custom-item notes, own furniture lists and removed services are retained", () => {
  const input = orderPdfFixture();
  const details = input.data.details!;
  details.furniture.expensive = true;
  details.furniture.expensiveText = "Antike Vase";
  details.furniture.heavy = true;
  details.furniture.heavyText = "Tresor";
  details.furniture.bulky = true;
  details.furniture.bulkyText = "Fluegel";
  details.furniture.ownItems = "Eigene Liste: Tisch und zwei Stuehle";
  details.extras.services.push({ kind: "service", catalogId: 999, name: "Entfernter Katalogeintrag", quantity: 2 });
  details.basis.hours = 0;
  const pdf = generateOrderPdf(input, now).toString("latin1");
  for (const text of ["Antike Vase", "Tresor", "Fluegel", "Eigene Liste", "Entfernter Katalogeintrag", "Gesamt:"]) assert.ok(pdf.includes(text), text);
  assert.ok(!pdf.includes("Gesamtpreis f"));
});

test("long content paginates and every page has its own numbered footer", () => {
  const input = orderPdfFixture();
  input.data.note = "Zusatzinformation ".repeat(2000);
  input.data.details!.furniture.items = Array.from({ length: 150 }, (_, i) => ({ name: `Moebel ${i}`, quantity: 1, category: "Wohnzimmer" }));
  const pdf = generateOrderPdf(input, now);
  const count = pdf.toString("latin1").match(/\/Type \/Page\b/g)!.length;
  assert.ok(count > 4);
  for (const [index, stream] of streams(pdf).slice(0, count).entries()) assert.ok(stream.includes(`1042 | Seite ${index + 1}/${count}`));
});

test("attachment filenames cannot contain paths or control characters", () => {
  const input = orderPdfFixture();
  input.data.customer.lastName = "Test/..\\Name\r\n";
  assert.ok(!/[/\\\r\n]/u.test(orderPdfFilename(input)));
});
