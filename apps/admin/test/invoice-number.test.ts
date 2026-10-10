import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { InvoiceEditorPage, InvoiceNumberField } from "../src/invoices/InvoiceEditorPage.js";

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

test("new invoice field visibly previews the number used without submitting it as a manual number", () => {
  const html = field(undefined);
  assert.match(html, /Verwendete Rechnungsnummer: R-10/u);
  assert.match(html, /placeholder="R-10"/u);
  assert.match(html, /value=""/u);
  assert.match(field(" R-0042 "), /Verwendete Rechnungsnummer: R-0042\. Nächste automatische Nummer: R-43/u);
  assert.match(field("R-4"), /Nächste automatische Nummer: R-10/u);
  assert.match(field("custom"), /Verwendete Rechnungsnummer: custom/u);
  assert.doesNotMatch(field("custom"), /Nächste automatische Nummer/u);
  assert.doesNotMatch(field("R-0"), /Nächste automatische Nummer/u);
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
