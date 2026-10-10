import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { JournalTab } from "../src/orders/JournalTab.js";

test("journal placeholder is shown in a flat card without extra explanation text", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(JournalTab, {}));
    assert.match(html, /MuiCard-root/u);
    assert.match(html, /Das Journal steht nach dem ersten Speichern des Auftrags zur Verfügung\./u);
    assert.ok(!html.includes("Das Journal protokolliert Aktionen"));
    assert.ok(!html.includes("MuiCardContent-root"));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});
