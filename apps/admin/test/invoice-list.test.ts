import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { InvoicesPage } from "../src/invoices/InvoicesPage.js";

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
});
