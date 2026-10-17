import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { initializeInvoiceNumber, InvoiceNumberField, InvoiceTaxField } from "../src/invoices/InvoiceEditorPage.js";
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
  assert.equal(initializeInvoiceNumber({ ...input, invoiceNumber: "R-42" }, "R-25").invoiceNumber, "R-42");
  assert.equal(initializeInvoiceNumber(input, initialized.invoiceNumber).invoiceNumber, "R-25");
  assert.equal(initializeInvoiceNumber(input, undefined), input);
});

test("sequence limits show an error only on creation", () => {
  assert.match(field("R-2147483647"), /aria-invalid="true"/u);
  assert.doesNotMatch(field("R-2147483647", 10, true), /aria-invalid="true"/u);
});
