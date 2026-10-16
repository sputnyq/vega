import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { SectionTabs } from "../src/components/SectionTabs.js";
import { resolveAdminRoute } from "../src/routes.js";
import { ContentManagementPage } from "../src/settings/ContentManagementPage.js";
import { OptionsPage } from "../src/settings/OptionsPage.js";
import { furnitureCategoryChoices, furnitureDefaults } from "../src/catalog/FurniturePage.js";

test("furniture defaults and category choices are stable and do not mutate the catalog", () => {
  const categories = [{ id: 3, name: "Küche", sort: 20 }, { id: 2, name: "Schlafzimmer", sort: 10 }, { id: 1, name: "Wohnzimmer", sort: 10 }];
  assert.deepEqual(furnitureCategoryChoices(categories).map((option) => option.value), [1, 2, 3]);
  assert.equal(categories[0]?.id, 3);
  assert.deepEqual(furnitureDefaults, { name: "", categoryIds: [], volume: 0, step: 1, sortOrder: 0 });
});

test("sticky section tabs meet the dense outlined navbar without a gap", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const props = {
      label: "Auftragsschritte",
      value: 0,
      tabs: [{ label: "Kunde", value: 0 }],
      onChange: () => {},
    };
    const sticky = renderToStaticMarkup(createElement(SectionTabs, { ...props, sticky: true }));
    assert.match(sticky, /position:sticky;top:50px;/u);
    const normal = renderToStaticMarkup(createElement(SectionTabs, props));
    assert.doesNotMatch(normal, /position:sticky/u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

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
    assert.equal([...html.matchAll(/aria-label="Angebot anlegen \(/gu)].length, 17);
    for (const label of [
      "Angebot anlegen (1 LKW, 2 Träger)",
      "Angebot anlegen (2 LKW, 8 Träger)",
      "Angebot anlegen (3 LKW, 5 Träger)",
      "Angebot anlegen (4 LKW, 10 Träger)",
    ]) assert.ok(html.includes(label));
    assert.ok(html.includes("Anfahrtskosten"));
    assert.ok(html.includes("Stundenpreis"));
    assert.ok(!html.includes("<table"));
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});
