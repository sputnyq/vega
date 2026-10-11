import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { initializeInvoiceNumber, InvoiceEditorPage, InvoiceNumberField, InvoiceTaxField } from "../src/invoices/InvoiceEditorPage.js";
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

test("invoice tax selector offers only 19 and zero percent and preserves the selected rate", () => {
  for (const taxPercent of [19, 0]) {
    const html = render(createElement(InvoiceTaxField, { taxPercent, onChange: () => {} }));
    assert.match(html, /<select\b/u);
    assert.equal([...html.matchAll(/<option\b/gu)].length, 2);
    assert.match(html, /<option value="19"[^>]*>19 %<\/option>/u);
    assert.match(html, /<option value="0"[^>]*>0 %<\/option>/u);
    assert.match(html, new RegExp(`<option value="${taxPercent}" selected="">`, "u"));
    assert.doesNotMatch(html, /type="number"/u);
  }
});

test("invoice tax selector requires correction of unsupported rates without displaying 19 percent", () => {
  for (const taxPercent of [7, 5.5, 100]) {
    const html = render(createElement(InvoiceTaxField, { taxPercent, onChange: () => {} }));
    assert.equal([...html.matchAll(/<option\b/gu)].length, 3);
    assert.match(html, /<option value="" disabled="" selected="">Bitte wählen<\/option>/u);
    assert.match(html, /aria-invalid="true"/u);
    assert.doesNotMatch(html, /<option value="19" selected/u);
  }
});

test("new invoice field displays the initialized number as an editable input value", () => {
  const input: InvoiceInput = { invoiceDate: "2026-10-10", company: "", customerName: "", customerStreet: "", customerPostalCity: "", taxPercent: 19, text: "", entries: [], dueDates: [] };
  const initialized = initializeInvoiceNumber(input, "R-25");
  assert.equal(initialized.invoiceNumber, "R-25");
  assert.match(field(initialized.invoiceNumber, 25), /value="R-25"/u);
  assert.equal(JSON.parse(JSON.stringify(initialized)).invoiceNumber, "R-25");
  assert.equal(initializeInvoiceNumber({ ...input, invoiceNumber: "R-42" }, "R-25").invoiceNumber, "R-42");
  assert.equal(initializeInvoiceNumber(input, initialized.invoiceNumber).invoiceNumber, "R-25");
  assert.equal(initializeInvoiceNumber(input, undefined), input);
});

test("number field keeps editable values without any helper text", () => {
  const html = field(undefined);
  assert.match(html, /placeholder="R-10"/u);
  assert.match(html, /value=""/u);
  assert.match(field("custom"), /value="custom"/u);
  assert.doesNotMatch(field("custom"), /Nächste automatische Nummer/u);
  assert.doesNotMatch(field("R-0"), /Nächste automatische Nummer/u);
  for (const number of [undefined, "R-25", "custom", "R-0", "R-2147483647"]) {
    for (const editing of [false, true]) {
      assert.doesNotMatch(field(number, 10, editing), /MuiFormHelperText|Nächste automatische Nummer|Leer lassen|Verwendete Rechnungsnummer/u);
    }
  }
});

test("sequence limits show an error only on creation, and editing never previews a sequence advance", () => {
  assert.match(field("R-2147483647"), /aria-invalid="true"/u);
  const html = field("R-9000", 10, true);
  assert.doesNotMatch(html, /Nächste automatische Nummer|Verwendete Rechnungsnummer/u);
  assert.doesNotMatch(field("R-2147483647", 10, true), /aria-invalid="true"/u);
});

test("blank and order-derived invoice editors wait for the authoritative number preview", () => {
  for (const props of [{}, { orderNumber: 1004 }]) {
    const html = render(createElement(InvoiceEditorPage, { ...props, navigate: () => {} }));
    assert.doesNotMatch(html, /Neue Rechnung/u);
    assert.match(html, /role="progressbar"/u);
    assert.doesNotMatch(html, />Speichern</u);
  }
  const editing = render(createElement(InvoiceEditorPage, { id: "invoice-1", navigate: () => {} }));
  assert.doesNotMatch(editing, /Rechnung bearbeiten/u);
});
