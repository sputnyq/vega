import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { invoiceTotal, InvoicesPage } from "../src/invoices/InvoicesPage.js";

test("invoice list uses clear and search icon buttons beside the search field", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  let html: string;
  try {
    html = renderToStaticMarkup(createElement(InvoicesPage, { navigate: () => {} }));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
  assert.match(html, /aria-label="Suche leeren"/u);
  assert.match(html, /aria-label="Rechnungen suchen"/u);
  assert.ok(!html.includes(">Suchen<"));
  assert.ok(!html.includes("Archivieren"));
  assert.ok(html.includes("Auftragsnummer"));
  assert.ok(html.includes("Rechnungssumme"));
});

test("invoice total includes tax using the invoice line quantities and prices", () => {
  assert.equal(invoiceTotal({
    entries: [
      { description: "Transport", quantity: 2, unitPrice: 100 },
      { description: "Verpackung", quantity: 1, unitPrice: 50 },
    ],
    taxPercent: 19,
  }), 297.5);
});
