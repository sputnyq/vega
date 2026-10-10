import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { resolveAdminRoute } from "../src/routes.js";
import { ContentManagementPage } from "../src/settings/ContentManagementPage.js";
import { OptionsPage } from "../src/settings/OptionsPage.js";

test("global price groups are only shown in the Prices content section", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(OptionsPage));
    assert.ok(!html.includes(">AGB<"));
    assert.ok(!html.includes(">Konfigurator<"));
    assert.ok(!html.includes("Globale Preise"));
    assert.ok(!html.includes("MuiGrid-grid-lg-12"));
    assert.ok(!html.includes("Einstellungen speichern"));
    assert.ok(!html.includes(">Neu laden<"));
    assert.ok(!html.includes("Nummernkreis speichern"));
    assert.ok(!html.includes("Nummernkreis neu laden"));
    assert.equal([...html.matchAll(/MuiGrid-grid-lg-6/gu)].length, 4);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("content navigation omits the overview and selects the resolved catalog section", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    for (const section of ["/services", "/furniture", "/categories", "/offers", "/packings", "/prices"]) {
      const route = resolveAdminRoute(`/settings${section}`);
      assert.ok(route);
      const html = renderToStaticMarkup(createElement(ContentManagementPage, {
        route,
      }));
      assert.doesNotMatch(html, /role="tablist"/u);
      assert.doesNotMatch(html, /MuiTabs-indicator/u);
      assert.ok(!html.includes(">Übersicht<"));
      assert.equal(html.includes(">AGB<"), section === "/prices");
      assert.equal(html.includes(">Konfigurator<"), section === "/prices");
      assert.equal(html.includes('type="number"'), section === "/prices" || section === "/offers");
      if (["/services", "/furniture", "/categories", "/packings"].includes(section)) {
        assert.doesNotMatch(html, /component="h2"[^>]*variant="h5"/u);
        assert.doesNotMatch(html, /Bohrarbeiten und sonstige Leistungen pflegen|Packmaterial, Preis/u);
      }
    }
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("offer management uses the legacy truck and workforce card groups", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const route = resolveAdminRoute("/settings/offers");
    assert.ok(route);
    const html = renderToStaticMarkup(createElement(ContentManagementPage, { route }));
    assert.deepEqual([...html.matchAll(/<h2[^>]*>(\d) LKW<\/h2>/gu)].map((match) => Number(match[1])), [1, 2, 3, 4]);
    assert.equal([...html.matchAll(/<hr\b/gu)].length, 0);
    assert.equal([...html.matchAll(/MuiPaper-outlined/gu)].length, 17);
    assert.equal([...html.matchAll(/<div class="[^"]*MuiCard-root[^"]*"/gu)].length, 17);
    assert.equal([...html.matchAll(/role="tablist"/gu)].length, 0);
    assert.equal([...html.matchAll(/aria-label="Angebot hinzufügen \(/gu)].length, 17);
    for (const label of [
      "Angebot hinzufügen (1 LKW, 2 Träger)",
      "Angebot hinzufügen (2 LKW, 8 Träger)",
      "Angebot hinzufügen (3 LKW, 5 Träger)",
      "Angebot hinzufügen (4 LKW, 10 Träger)",
    ]) assert.ok(html.includes(label));
    assert.ok(html.includes("Anfahrtskosten"));
    assert.ok(html.includes("Stundenpreis"));
    assert.ok(!html.includes("<table"));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});
