import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AdminShell } from "../src/components/AdminShell.js";
import { OrderCreatePage } from "../src/orders/OrderCreatePage.js";
import { CustomerTab } from "../src/orders/CustomerTab.js";
import { AppointmentFields } from "../src/orders/AppointmentFields.js";
import { AddressesTab } from "../src/orders/AddressesTab.js";
import { FurnitureTab } from "../src/orders/FurnitureTab.js";
import { ExtrasTab } from "../src/orders/ExtrasTab.js";
import { BasisTab } from "../src/orders/BasisTab.js";
import { ConditionsTab } from "../src/orders/ConditionsTab.js";
import { createEmptyOrder } from "../src/orders/order-form-types.js";
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
  assert.deepEqual(labels.slice(0, 7), ["Menü öffnen", "Auftrag speichern", "Angebotskopie anlegen", "PDF erzeugen", "E-Mail versenden", "Auftrag archivieren", "Rechnung aus Auftrag anlegen"]);
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
  assert.ok(emailButton);
  assert.doesNotMatch(emailButton, /\bdisabled/u);
});

test("all invoice drafts expose toolbar actions and a dirty badge, but archive lists do not", () => {
  const user: StaffUser = { id: "test", name: "Test", email: "test@example.test", role: "Admin", twoFactorEnabled: true, mustChangePassword: false, blocked: false };
  for (const pathname of ["/invoices/new", "/blanco", "/invoices/new/from-order/1004", "/invoices/invoice-test"]) {
    const route = resolveAdminRoute(pathname);
    assert.ok(route);
    const html = render(createElement(AdminShell, { user, route, pathname, navigate: () => {}, invoiceDirty: true, children: null }));
    const header = html.slice(0, html.indexOf("</header>"));
    for (const label of ["Rechnung speichern", "Rechnungs-PDF speichern", "Rechnung per E-Mail versenden", "Rechnung archivieren"]) assert.ok(header.includes(`aria-label="${label}"`));
    assert.match(header, /MuiBadge-dot/u);
    assert.doesNotMatch(header, /class="[^"]*MuiBadge-invisible/u);
    const pdfButton = header.match(/<(?:button|a)[^>]*aria-label="Rechnungs-PDF speichern"[^>]*>/u)?.[0];
    assert.ok(pdfButton);
    assert.doesNotMatch(pdfButton, /href=/u);
    if (pathname !== "/invoices/invoice-test") assert.match(header, /<button[^>]*disabled[^>]*aria-label="Rechnung archivieren"/u);
  }
  const pathname = "/invoices/archived";
  const route = resolveAdminRoute(pathname);
  assert.ok(route);
  const html = render(createElement(AdminShell, { user, route, pathname, navigate: () => {}, children: null }));
  assert.doesNotMatch(html.slice(0, html.indexOf("</header>")), /aria-label="Rechnung speichern"/u);
});

test("dirty documents allow only saving and clean saved documents enable follow-up actions", () => {
  const user: StaffUser = { id: "test", name: "Test", email: "test@example.test", role: "Admin", twoFactorEnabled: true, mustChangePassword: false, blocked: false };
  for (const kind of ["order", "invoice"] as const) {
    for (const fresh of [true, false]) {
      for (const dirty of [true, false]) {
        for (const busy of [true, false]) {
          const pathname = kind === "order" ? fresh ? "/edit/-1" : "/edit/1004" : fresh ? "/invoices/new" : "/invoices/invoice-test";
          const route = resolveAdminRoute(pathname);
          assert.ok(route);
          const html = render(createElement(AdminShell, { user, route, pathname, navigate: () => {}, orderDirty: dirty, invoiceDirty: dirty, orderBusy: busy, invoiceBusy: busy, children: null }));
          const header = html.slice(0, html.indexOf("</header>"));
          const controls = [...header.matchAll(/<(?:button|a)\b[^>]*aria-label="([^"]+)"[^>]*>/gu)];
          const actions = controls.filter((match) => match[1] !== "Menü öffnen");
          assert.equal(actions.length, kind === "order" ? 6 : 4);
          for (const match of actions) {
            const save = match[1] === (kind === "order" ? "Auftrag speichern" : "Rechnung speichern");
            const disabled = /\bdisabled(?:=""|="true")/u.test(match[0]);
            assert.equal(disabled, save ? busy : Boolean(busy || dirty || fresh), `${pathname}, ${match[1]}, dirty=${dirty}, busy=${busy}`);
          }
          const badge = header.match(/<span\b[^>]*class="[^"]*MuiBadge-badge[^"]*"/u)?.[0];
          assert.ok(badge);
          assert.equal(badge.includes("MuiBadge-invisible"), !(fresh || dirty));
        }
      }
    }
  }
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
    navigate: () => {}, onDirtyChange: () => {}, onBusyChange: () => {}, dirty: false,
  }));
  assert.ok(!html.includes("Buchhaltung"));
  assert.ok(!html.includes("Rechnung aus Auftrag anlegen"));
  assert.match(html, /id="order-tab-6" aria-controls="order-tabpanel-6"[^>]*>Journal/u);
  assert.ok(!html.includes('id="order-tab-7"'));
  const tabs = html.slice(html.indexOf('aria-label="Auftragsschritte"') - 500, html.indexOf('aria-label="Auftragsschritte"') + 200);
  assert.ok(!tabs.includes("MuiPaper-outlined"));
});

test("customer cards stack on mobile and place notes beside customer details on desktop", () => {
  const html = render(createElement(CustomerTab, { value: createEmptyOrder(), update: () => {} }));
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\)/u);
  assert.match(html, /@media \(min-width:900px\)[^}]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/u);
  assert.match(html, /grid-row:span 2/u);
  assert.equal([...html.matchAll(/MuiPaper-outlined/gu)].length, 3);
  assert.doesNotMatch(html, /max-width:760px/u);
});

test("order cards use responsive columns without squeezing list controls", () => {
  const value = createEmptyOrder();
  const addresses = render(createElement(AddressesTab, { value, update: () => {}, onDetailsChange: () => {} }));
  assert.equal([...addresses.matchAll(/MuiGrid-grid-md-6/gu)].length, 2);
  const furniture = render(createElement(FurnitureTab, { value, update: () => {}, onFurnitureChange: () => {} }));
  assert.match(furniture, /@media \(min-width:1200px\)[^}]*grid-template-columns:minmax\(0, 1fr\) minmax\(0, 2fr\)/u);
  assert.equal([...furniture.matchAll(/MuiGrid-grid-sm-6/gu)].length, 2);
  const extras = render(createElement(ExtrasTab, { value, onExtrasChange: () => {} }));
  assert.match(extras, /MuiGrid-grid-md-4/u);
  assert.match(extras, /MuiGrid-grid-md-8/u);
  const basis = render(createElement(BasisTab, { value, update: () => {}, onBasisChange: () => {} }));
  assert.equal([...basis.matchAll(/MuiGrid-grid-md-6/gu)].length, 2);
  const conditions = render(createElement(ConditionsTab, { value, onConditionsChange: () => {} }));
  assert.match(conditions, /@media \(min-width:900px\)[^}]*grid-template-columns:minmax\(0, 1fr\) minmax\(0, 2fr\)/u);
});

test("staff can view but cannot edit the customer alternative date range", () => {
  const html = render(createElement(AppointmentFields, {
    value: { movingDate: "2026-11-01", movingTime: "10:00", dateFrom: "2026-11-02", dateTo: "2026-11-04", dateFixed: false },
    onChange: () => {},
  }));
  const inputs = [...html.matchAll(/<input\b[^>]*>/gu)].map((match) => match[0]);
  assert.equal(inputs.filter((input) => /readOnly=""/u.test(input)).length, 2);
  for (const date of ["2026-11-02", "2026-11-04"]) {
    const input = inputs.find((entry) => entry.includes(`value="${date}"`));
    assert.ok(input);
    assert.match(input, /readOnly=""/u);
    assert.match(input, /type="date"/u);
  }
  for (const value of ["2026-11-01", "10:00"]) {
    const input = inputs.find((entry) => entry.includes(`value="${value}"`));
    assert.ok(input);
    assert.doesNotMatch(input, /readOnly/u);
  }
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
  const createButton = html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*Auftrag anlegen<\/button>/u)?.[0];
  assert.ok(createButton);
  assert.match(createButton, /MuiButton-startIcon/u);
  assert.match(createButton, /data-testid="AddOutlinedIcon"/u);
  assert.ok(!html.includes(">Suchen<"));
  assert.ok(!html.includes(">Leeren<"));
});
