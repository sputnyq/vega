import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AdminShell } from "../src/components/AdminShell.js";
import { AppointmentFields } from "../src/orders/AppointmentFields.js";
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

test("only admins can create an invoice from the saved order", () => {
  const html = toolbar("Admin");
  const header = html.slice(0, html.indexOf("</header>"));
  const invoiceButton = header.match(/<button\b[^>]*aria-label="Rechnung aus Auftrag anlegen"[^>]*>/u)?.[0];
  assert.ok(invoiceButton);
  for (const attribute of ['form="order-create-form"', 'name="action"', 'value="invoice"']) assert.ok(invoiceButton.includes(attribute));
  assert.ok(!toolbar("Kundenberater").includes('aria-label="Rechnung aus Auftrag anlegen"'));
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
          const saveLabel = kind === "order" ? "Auftrag speichern" : "Rechnung speichern";
          const expected = kind === "order"
            ? [saveLabel, "Angebotskopie anlegen", "PDF erzeugen", "E-Mail versenden", "Auftrag archivieren", "Rechnung aus Auftrag anlegen"]
            : [saveLabel, "Rechnungs-PDF speichern", "Rechnung per E-Mail versenden", "Rechnung archivieren"];
          assert.deepEqual(actions.map((match) => match[1]).sort(), expected.sort());
          for (const match of actions) {
            const save = match[1] === saveLabel;
            const disabled = /\bdisabled(?:=""|="true")/u.test(match[0]);
            assert.equal(disabled, save ? busy : Boolean(busy || dirty || fresh), `${pathname}, ${match[1]}, dirty=${dirty}, busy=${busy}`);
            if (save) assert.ok(match[0].includes(`form="${kind === "order" ? "order-create-form" : "invoice-editor-form"}"`));
            if (disabled) assert.doesNotMatch(match[0], /\bhref=/u);
          }
        }
      }
    }
  }
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
