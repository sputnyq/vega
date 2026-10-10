import assert from "node:assert/strict";
import test from "node:test";
import { resolveAdminRoute } from "../src/routes.js";

test("legacy order and settings routes resolve to their existing sections", () => {
  assert.equal(resolveAdminRoute("/")?.title, "Aufträge");
  assert.equal(resolveAdminRoute("/edit/-1")?.title, "Neuer Auftrag");
  assert.equal(resolveAdminRoute("/edit/-1")?.path, "/edit/-1");
  assert.equal(resolveAdminRoute("/edit/42")?.title, "Auftrag 42");
  assert.equal(resolveAdminRoute("/blanco")?.title, "Neue Rechnung");
  assert.equal(resolveAdminRoute("/settings")?.title, "Optionen");
  assert.equal(resolveAdminRoute("/settings/offers")?.title, "Angebote");
  assert.equal(resolveAdminRoute("/settings/packings")?.title, "Verpackung");
  assert.equal(resolveAdminRoute("/settings/services")?.title, "Leistungen");
  assert.equal(resolveAdminRoute("/settings/categories")?.title, "Möbel-Kategorien");
  assert.equal(resolveAdminRoute("/settings/furniture")?.title, "Möbel");
  assert.equal(resolveAdminRoute("/settings/furniture")?.settingsArea, "content");
  assert.equal(resolveAdminRoute("/email-text/42")?.title, "E-Mail-Text");
});

test("settings routes separate options, content management, and user management", () => {
  assert.equal(resolveAdminRoute("/settings")?.settingsArea, "options");
  assert.equal(resolveAdminRoute("/settings/content")?.contentSection, "overview");
  assert.equal(resolveAdminRoute("/settings/content/furniture")?.contentSection, "furniture");
  assert.equal(resolveAdminRoute("/settings/content/categories")?.contentSection, "categories");
  assert.equal(resolveAdminRoute("/settings/content/offers")?.contentSection, "offers");
  assert.equal(resolveAdminRoute("/settings/content/packings")?.contentSection, "packings");
  assert.equal(resolveAdminRoute("/settings/content/services")?.contentSection, "services");
  assert.equal(resolveAdminRoute("/settings/users")?.settingsArea, "users");
  assert.equal(resolveAdminRoute("/settings/users")?.adminOnly, true);
});

test("new archive, invoice, and profile routes are available with admin-only metadata", () => {
  assert.equal(resolveAdminRoute("/invoices")?.adminOnly, true);
  assert.equal(resolveAdminRoute("/invoices/new")?.adminOnly, true);
  assert.equal(resolveAdminRoute("/invoices/archived")?.adminOnly, true);
  assert.equal(resolveAdminRoute("/orders/archived")?.adminOnly, undefined);
  assert.equal(resolveAdminRoute("/profile")?.profile, true);
});

test("unknown and malformed legacy paths resolve to not found", () => {
  assert.equal(resolveAdminRoute("/unknown"), null);
  assert.equal(resolveAdminRoute("/edit/%E0%A4%A"), null);
  assert.equal(resolveAdminRoute("/email-text/%E0%A4%A"), null);
});

test("order invoice templates resolve to an admin-only unsaved editor", () => {
  const route = resolveAdminRoute("/invoices/new/from-order/1004");
  assert.equal(route?.sourceOrderNumber, 1004);
  assert.equal(route?.title, "Neue Rechnung");
  assert.equal(route?.adminOnly, true);
  for (const path of ["/invoices/new/from-order/0", "/invoices/new/from-order/no", "/invoices/new/from-order/9007199254740992"]) {
    assert.equal(resolveAdminRoute(path), null);
  }
});
