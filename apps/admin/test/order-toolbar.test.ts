import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AdminShell } from "../src/components/AdminShell.js";
import { OrderCreatePage } from "../src/orders/OrderCreatePage.js";
import { OrdersPage } from "../src/orders/OrdersPage.js";
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

test("invoice editor toolbar exposes save, PDF and archive actions", () => {
  const pathname = "/invoices/test-invoice-id";
  const route = resolveAdminRoute(pathname);
  assert.ok(route);
  const html = render(createElement(AdminShell, {
    user: { id: "test", name: "Test", email: "test@example.test", role: "Admin", twoFactorEnabled: true, mustChangePassword: false, blocked: false },
    route, pathname, navigate: () => {}, children: null,
  }));
  for (const label of ["Rechnung speichern", "Rechnungs-PDF speichern", "Rechnung per E-Mail versenden", "Rechnung archivieren"]) {
    assert.ok(html.includes(`aria-label="${label}"`));
  }
  assert.ok(html.includes('form="invoice-editor-form"'));
  const emailButton = html.match(/<button\b[^>]*aria-label="Rechnung per E-Mail versenden"[^>]*>/u)?.[0];
  assert.ok(emailButton?.includes("disabled"));
});

test("order and invoice editor titles show a new label or their saved number", () => {
  const user: StaffUser = { id: "test", name: "Test", email: "test@example.test", role: "Admin", twoFactorEnabled: true, mustChangePassword: false, blocked: false };
  const invoicePath = "/invoices/test-invoice-id";
  const invoiceRoute = resolveAdminRoute(invoicePath);
  assert.ok(invoiceRoute);
  const savedInvoice = render(createElement(AdminShell, {
    user, route: invoiceRoute, pathname: invoicePath, navigate: () => {}, invoiceNumber: "R-201", children: null,
  }));
  assert.match(savedInvoice, /<h1[^>]*>Rechnung \| R-201<\/h1>/u);

  const newInvoiceRoute = resolveAdminRoute("/invoices/new");
  assert.ok(newInvoiceRoute);
  const newInvoice = render(createElement(AdminShell, {
    user, route: newInvoiceRoute, pathname: "/invoices/new", navigate: () => {}, children: null,
  }));
  assert.match(newInvoice, /<h1[^>]*>Rechnung \| Neu<\/h1>/u);

  const newOrderRoute = resolveAdminRoute("/edit/-1");
  assert.ok(newOrderRoute);
  const newOrder = render(createElement(AdminShell, {
    user, route: newOrderRoute, pathname: "/edit/-1", navigate: () => {}, children: null,
  }));
  assert.match(newOrder, /<h1[^>]*>Auftrag \| Neu<\/h1>/u);

  const savedOrderRoute = resolveAdminRoute("/edit/1004");
  assert.ok(savedOrderRoute);
  const savedOrder = render(createElement(AdminShell, {
    user, route: savedOrderRoute, pathname: "/edit/1004", navigate: () => {}, children: null,
  }));
  assert.match(savedOrder, /<h1[^>]*>Auftrag \| 1004<\/h1>/u);
});

test("order editor omits accounting and links the journal as the seventh tab", () => {
  const html = render(createElement(OrderCreatePage, {
    navigate: () => {}, onSaved: () => {}, onDirtyChange: () => {}, onBusyChange: () => {}, dirty: false,
  }));
  assert.ok(!html.includes("Buchhaltung"));
  assert.ok(!html.includes("Rechnung aus Auftrag anlegen"));
  assert.match(html, /id="order-tab-6" aria-controls="order-tabpanel-6"[^>]*>Journal/u);
  assert.ok(!html.includes('id="order-tab-7"'));
  const tabs = html.slice(html.indexOf('aria-label="Auftragsschritte"') - 500, html.indexOf('aria-label="Auftragsschritte"') + 200);
  assert.ok(!tabs.includes("MuiPaper-outlined"));
});

test("order list uses clear and search icon buttons around the search field", () => {
  const previousWindow = Reflect.get(globalThis, "window");
  Reflect.set(globalThis, "window", { location: { search: "" } });
  let html: string;
  try { html = render(createElement(OrdersPage, { navigate: () => {} })); }
  finally {
    if (previousWindow === undefined) Reflect.deleteProperty(globalThis, "window");
    else Reflect.set(globalThis, "window", previousWindow);
  }
  assert.match(html, /aria-label="Suche leeren"/u);
  assert.match(html, /aria-label="Aufträge suchen"/u);
  assert.ok(!html.includes(">Suchen<"));
  assert.ok(!html.includes(">Leeren<"));
});
