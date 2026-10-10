import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AdminShell } from "../src/components/AdminShell.js";
import { OrderCreatePage } from "../src/orders/OrderCreatePage.js";
import { resolveAdminRoute } from "../src/routes.js";
import type { StaffUser } from "../src/types.js";

function render(element: React.ReactElement) {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try { return renderToStaticMarkup(element); }
  finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

function toolbar(role: StaffUser["role"]) {
  const route = resolveAdminRoute("/edit/1004");
  assert.ok(route);
  return render(createElement(AdminShell, {
    user: { id: "test", name: "Test", email: "test@example.test", role, twoFactorEnabled: true, mustChangePassword: false, blocked: false },
    route, pathname: "/edit/1004", navigate: () => {}, children: null,
  }));
}

test("order toolbar separates four primary actions, archiving and admin invoice creation", () => {
  const html = toolbar("Admin");
  const labels = [...html.matchAll(/<button\b[^>]*aria-label="([^"]+)"/gu)].map((match) => match[1]!);
  assert.deepEqual(labels.slice(0, 7), ["Menü öffnen", "Auftrag speichern", "Angebotskopie erstellen", "PDF erzeugen", "E-Mail versenden", "Auftrag archivieren", "Rechnung aus Auftrag anlegen"]);
  const header = html.slice(0, html.indexOf("</header>"));
  assert.equal((header.match(/MuiDivider-vertical/gu) ?? []).length, 2);
  const invoiceButton = header.match(/<button\b[^>]*aria-label="Rechnung aus Auftrag anlegen"[^>]*>/u)?.[0];
  assert.ok(invoiceButton);
  for (const attribute of ['form="order-create-form"', 'name="action"', 'value="invoice"']) assert.ok(invoiceButton.includes(attribute));
  assert.ok(!toolbar("Kundenberater").includes('aria-label="Rechnung aus Auftrag anlegen"'));
});

test("order editor omits accounting and links the journal as the seventh tab", () => {
  const html = render(createElement(OrderCreatePage, {
    navigate: () => {}, onSaved: () => {}, onDirtyChange: () => {}, onBusyChange: () => {}, dirty: false,
  }));
  assert.ok(!html.includes("Buchhaltung"));
  assert.ok(!html.includes("Rechnung aus Auftrag anlegen"));
  assert.match(html, /id="order-tab-6" aria-controls="order-tabpanel-6"[^>]*>Journal/u);
  assert.ok(!html.includes('id="order-tab-7"'));
});
