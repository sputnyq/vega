import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { initializeInvoiceNumber, InvoiceEditorPage, InvoiceNumberField } from "../src/invoices/InvoiceEditorPage.js";
import type { InvoiceInput } from "@vega/domain";

function render(element: React.ReactElement) {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try { return renderToStaticMarkup(element); }
  finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

function field(invoiceNumber: string | undefined, nextValue = 10, editing = false) {
  return render(createElement(InvoiceNumberField, { invoiceNumber, nextValue, editing, onChange: () => {} }));
}

test("new invoice field displays the initialized number as an editable input value", () => {
  const input: InvoiceInput = { invoiceDate: "2026-10-10", company: "", customerName: "", customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [] };
  const initialized = initializeInvoiceNumber(input, "R-25");
  assert.equal(initialized.invoiceNumber, "R-25");
  assert.match(field(initialized.invoiceNumber, 25), /value="R-25"/u);
  assert.match(field(initialized.invoiceNumber, 25), /Nächste automatische Nummer: R-26/u);
  assert.equal(JSON.parse(JSON.stringify(initialized)).invoiceNumber, "R-25");
  assert.equal(initializeInvoiceNumber({ ...input, invoiceNumber: "R-42" }, "R-25").invoiceNumber, "R-42");
  assert.equal(initializeInvoiceNumber(input, initialized.invoiceNumber).invoiceNumber, "R-25");
  assert.equal(initializeInvoiceNumber(input, undefined), input);
});

test("number field keeps automatic fallback and shows the next number for manual input", () => {
  const html = field(undefined);
  assert.match(html, /placeholder="R-10"/u);
  assert.match(html, /value=""/u);
  assert.match(field(" R-0042 "), /Nächste automatische Nummer: R-43/u);
  assert.match(field("R-4"), /Nächste automatische Nummer: R-10/u);
  assert.match(field("custom"), /value="custom"/u);
  assert.doesNotMatch(field("custom"), /Nächste automatische Nummer/u);
  assert.doesNotMatch(field("R-0"), /Nächste automatische Nummer/u);
  for (const number of [undefined, "R-25", "custom", "R-0"]) {
    assert.doesNotMatch(field(number), /Leer lassen für automatische Nummer|Verwendete Rechnungsnummer/u);
  }
});

test("sequence limits show an error only on creation, and editing never previews a sequence advance", () => {
  assert.match(field("R-2147483647"), /aria-invalid="true"/u);
  assert.match(field("R-2147483647"), /maximal R-2147483646/u);
  const html = field("R-9000", 10, true);
  assert.match(html, /bisherige Nummer beizubehalten/u);
  assert.doesNotMatch(html, /Nächste automatische Nummer|Verwendete Rechnungsnummer/u);
  assert.doesNotMatch(field("R-2147483647", 10, true), /aria-invalid="true"/u);
});

test("blank and order-derived invoice editors wait for the authoritative number preview", () => {
  for (const props of [{}, { orderNumber: 1004 }]) {
    const html = render(createElement(InvoiceEditorPage, { ...props, navigate: () => {} }));
    assert.match(html, /Neue Rechnung/u);
    assert.match(html, /role="progressbar"/u);
    assert.doesNotMatch(html, />Speichern</u);
  }
});
