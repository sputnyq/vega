import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ThemeProvider } from "@mui/material/styles";
import { adminTheme } from "../src/theme.js";
import { SectionTabs } from "../src/components/SectionTabs.js";
import { resolveAdminRoute } from "../src/routes.js";
import { ContentManagementPage } from "../src/settings/ContentManagementPage.js";
import { OptionsPage } from "../src/settings/OptionsPage.js";
import { furnitureCategoryChoices, furnitureDefaults } from "../src/catalog/FurniturePage.js";

test("furniture editor uses required defaults and sorted category checkboxes below its fields", async () => {
  const categories = [{ id: 3, name: "Küche", sort: 20 }, { id: 2, name: "Schlafzimmer", sort: 10 }, { id: 1, name: "Wohnzimmer", sort: 10 }];
  assert.deepEqual(furnitureCategoryChoices(categories).map((option) => option.value), [1, 2, 3]);
  assert.equal(categories[0]?.id, 3);
  assert.deepEqual(furnitureDefaults, { name: "", categoryIds: [], volume: 0, step: 1, sortOrder: 0 });
  const furniture = await readFile(new URL("../src/catalog/FurniturePage.tsx", import.meta.url), "utf8");
  const fields = furniture.slice(furniture.indexOf("const fields:"), furniture.indexOf("const columns:"));
  assert.deepEqual([...fields.matchAll(/name: "([^"]+)"/gu)].map((match) => match[1]), ["name", "volume", "step", "sortOrder", "categoryIds"]);
  assert.match(fields, /type: "checkboxes"/u);
  assert.match(fields, /name: "volume", label: "Volumen"[^\n]*unit: "m³"/u);
  const editor = await readFile(new URL("../src/catalog/CatalogCrudPage.tsx", import.meta.url), "utf8");
  const checkboxes = editor.slice(editor.indexOf('if (field.type === "checkboxes")'), editor.indexOf('if (field.type === "boolean")'));
  assert.match(checkboxes, /<FormGroup>/u);
  assert.match(checkboxes, /<Checkbox checked=/u);
  assert.match(checkboxes, /event\.target\.checked/u);
  assert.doesNotMatch(checkboxes, /<Select|<FormGroup row/u);
});

test("catalog money fields display the euro at the right end of the input", async () => {
  const source = await readFile(new URL("../src/catalog/CatalogCrudPage.tsx", import.meta.url), "utf8");
  assert.match(source, /field\.type === "money" \|\| field\.unit \? \{ input: \{ endAdornment: <InputAdornment position="end">\{field\.type === "money" \? "€" : field\.unit\}<\/InputAdornment>/u);
  assert.ok(source.includes('field.label.replace(/\\s*\\(€\\)$/u, "")'));
});

test("sticky section tabs stay opaque and meet the responsive navbar without overlap", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const props = {
      label: "Auftragsschritte",
      value: 0,
      tabs: [{ label: "Kunde", value: 0 }],
      onChange: () => {},
    };
    const sticky = renderToStaticMarkup(createElement(ThemeProvider, { theme: adminTheme },
      createElement(SectionTabs, { ...props, sticky: true })));
    assert.match(sticky, /position:sticky/u);
    assert.match(sticky, /@media \(min-width:0px\)[^}]*top:58px/u);
    assert.match(sticky, /@media \(min-width:900px\)[^}]*top:68px/u);
    assert.match(sticky, /background-color:var\(--mui-palette-background-default\)/u);
    assert.match(sticky, /border-bottom:1px solid/u);
    const normal = renderToStaticMarkup(createElement(SectionTabs, props));
    assert.doesNotMatch(normal, /position:sticky/u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("catalog tables use a three-dot action menu and right-aligned creation wording", async () => {
  const source = await readFile(new URL("../src/catalog/CatalogCrudPage.tsx", import.meta.url), "utf8");
  assert.match(source, /aria-haspopup="menu"/u);
  assert.match(source, /<MoreVert\s*\/>/u);
  assert.match(source, /<Menu id="catalog-actions-menu"/u);
  assert.match(source, /setActionMenu\(null\); openEdit\(item\)/u);
  assert.match(source, /setActionMenu\(null\); void remove\(item\)/u);
  assert.match(source, /window\.confirm/u);
  assert.match(source, /useFlexGap sx=\{\{ justifyContent: "flex-end", alignItems: "center", flexWrap: "wrap" \}\}/u);
  assert.match(source, /toolbarContent && <Stack direction="row" sx=\{\{ flexGrow: 1/u);
  assert.match(source, /onClick=\{openCreate\}>Eintrag anlegen/u);
  assert.doesNotMatch(source, /Eintrag hinzufügen|>Hinzufügen</u);
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
