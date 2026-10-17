import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { AdminShell } from "../src/components/AdminShell.js";
import { AppointmentFields } from "../src/orders/AppointmentFields.js";
import { ConditionsTab } from "../src/orders/ConditionsTab.js";
import { createEmptyOrder } from "../src/orders/order-form-types.js";
import { resolveAdminRoute } from "../src/routes.js";
import type { StaffUser } from "../src/types.js";

function render(element: React.ReactElement) {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    return renderToStaticMarkup(element);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
}

function toolbar(role: StaffUser["role"]) {
  const route = resolveAdminRoute("/edit/1004");
  assert.ok(route);
  return render(
    createElement(AdminShell, {
      user: {
        id: "test",
        name: "Test",
        email: "test@example.test",
        role,
        twoFactorEnabled: true,
        mustChangePassword: false,
        blocked: false,
      },
      route,
      pathname: "/edit/1004",
      navigate: () => {},
      children: null,
    }),
  );
}

test("only admins can create an invoice from the saved order", () => {
  const html = toolbar("Admin");
  const header = html.slice(0, html.indexOf("</header>"));
  const invoiceButton = header.match(
    /<button\b[^>]*aria-label="Rechnung aus Auftrag anlegen"[^>]*>/u,
  )?.[0];
  assert.ok(invoiceButton);
  for (const attribute of [
    'form="order-create-form"',
    'name="action"',
    'value="invoice"',
  ])
    assert.ok(invoiceButton.includes(attribute));
  assert.ok(
    !toolbar("Kundenberater").includes(
      'aria-label="Rechnung aus Auftrag anlegen"',
    ),
  );
});

test("dirty documents allow only saving and clean saved documents enable follow-up actions", () => {
  const user: StaffUser = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    role: "Admin",
    twoFactorEnabled: true,
    mustChangePassword: false,
    blocked: false,
  };
  for (const kind of ["order", "invoice"] as const) {
    for (const fresh of [true, false]) {
      for (const dirty of [true, false]) {
        for (const busy of [true, false]) {
          const pathname =
            kind === "order"
              ? fresh
                ? "/edit/-1"
                : "/edit/1004"
              : fresh
                ? "/invoices/new"
                : "/invoices/invoice-test";
          const route = resolveAdminRoute(pathname);
          assert.ok(route);
          const html = render(
            createElement(AdminShell, {
              user,
              route,
              pathname,
              navigate: () => {},
              orderDirty: dirty,
              invoiceDirty: dirty,
              orderBusy: busy,
              invoiceBusy: busy,
              children: null,
            }),
          );
          const header = html.slice(0, html.indexOf("</header>"));
          const controls = [
            ...header.matchAll(
              /<(?:button|a)\b[^>]*aria-label="([^"]+)"[^>]*>/gu,
            ),
          ];
          const actions = controls.filter(
            (match) => match[1] !== "Menü öffnen",
          );
          const saveLabel =
            kind === "order" ? "Auftrag speichern" : "Rechnung speichern";
          const expected =
            kind === "order"
              ? [
                  saveLabel,
                  "Angebotskopie anlegen",
                  "PDF erzeugen",
                  "E-Mail versenden",
                  "Auftrag archivieren",
                  "Rechnung aus Auftrag anlegen",
                ]
              : [
                  saveLabel,
                  "Rechnungs-PDF speichern",
                  "Rechnung per E-Mail versenden",
                  "Rechnung archivieren",
                ];
          assert.deepEqual(
            actions.map((match) => match[1]).sort(),
            expected.sort(),
          );
          for (const match of actions) {
            const save = match[1] === saveLabel;
            const disabled = /\bdisabled(?:=""|="true")/u.test(match[0]);
            assert.equal(
              disabled,
              save ? busy : Boolean(busy || dirty || fresh),
              `${pathname}, ${match[1]}, dirty=${dirty}, busy=${busy}`,
            );
            if (save)
              assert.ok(
                match[0].includes(
                  `form="${kind === "order" ? "order-create-form" : "invoice-editor-form"}"`,
                ),
              );
            if (disabled) assert.doesNotMatch(match[0], /\bhref=/u);
          }
        }
      }
    }
  }
});

test("invoice dirty state is tracked from every edit and cleared only after successful saving", async () => {
  const source = await readFile(
    new URL("../src/invoices/InvoiceEditorPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /\[dirty, setDirty\] = useState\(!id\)/u);
  assert.match(source, /onDirtyChange\?\.\(dirty\)/u);
  assert.match(source, /function change[^\n]*setDirty\(true\)/u);
  assert.match(
    source,
    /if \(!response\.ok \|\| !body\.data\)[^\n]*return; \}\s*setValue\(body\.data\);\s*setDirty\(false\);/u,
  );
  assert.match(
    source,
    /onBusyChange\?\.\(busy \|\| loading \|\| numberLoading \|\| loadFailed\)/u,
  );
  const order = await readFile(
    new URL("../src/orders/OrderCreatePage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    order,
    /if \(\(exportPdf \|\| createInvoice\) && \(dirty \|\| orderNumber === undefined\)\)/u,
  );
  assert.doesNotMatch(
    order,
    /dirty \? save\(\)|if \(dirty && !await save\(\)\)/u,
  );
});

test("order and invoice editor titles show a new label or their saved number", () => {
  const user: StaffUser = {
    id: "test",
    name: "Test",
    email: "test@example.test",
    role: "Admin",
    twoFactorEnabled: true,
    mustChangePassword: false,
    blocked: false,
  };
  const invoicePath = "/invoices/test-invoice-id";
  const invoiceRoute = resolveAdminRoute(invoicePath);
  assert.ok(invoiceRoute);
  const savedInvoice = render(
    createElement(AdminShell, {
      user,
      route: invoiceRoute,
      pathname: invoicePath,
      navigate: () => {},
      invoiceNumber: "R-201",
      children: null,
    }),
  );
  assert.match(savedInvoice, /<h1[^>]*>Rechnung \| R-201<\/h1>/u);

  const newInvoiceRoute = resolveAdminRoute("/invoices/new");
  assert.ok(newInvoiceRoute);
  const newInvoice = render(
    createElement(AdminShell, {
      user,
      route: newInvoiceRoute,
      pathname: "/invoices/new",
      navigate: () => {},
      children: null,
    }),
  );
  assert.match(newInvoice, /<h1[^>]*>Rechnung \| Neu<\/h1>/u);

  const newOrderRoute = resolveAdminRoute("/edit/-1");
  assert.ok(newOrderRoute);
  const newOrder = render(
    createElement(AdminShell, {
      user,
      route: newOrderRoute,
      pathname: "/edit/-1",
      navigate: () => {},
      children: null,
    }),
  );
  assert.match(newOrder, /<h1[^>]*>Auftrag \| Neu<\/h1>/u);

  const savedOrderRoute = resolveAdminRoute("/edit/1004");
  assert.ok(savedOrderRoute);
  const savedOrder = render(
    createElement(AdminShell, {
      user,
      route: savedOrderRoute,
      pathname: "/edit/1004",
      navigate: () => {},
      children: null,
    }),
  );
  assert.match(savedOrder, /<h1[^>]*>Auftrag \| 1004<\/h1>/u);
});

test("order editor omits accounting and links the journal as the seventh tab", () => {
  const html = render(
    createElement(OrderCreatePage, {
      navigate: () => {},
      onDirtyChange: () => {},
      onBusyChange: () => {},
      dirty: false,
    }),
  );
  assert.ok(!html.includes("Buchhaltung"));
  assert.ok(!html.includes("Rechnung aus Auftrag anlegen"));
  assert.match(
    html,
    /id="order-tab-6" aria-controls="order-tabpanel-6"[^>]*>Journal/u,
  );
  assert.ok(!html.includes('id="order-tab-7"'));
  const tabs = html.slice(
    html.indexOf('aria-label="Auftragsschritte"') - 500,
    html.indexOf('aria-label="Auftragsschritte"') + 200,
  );
  assert.ok(!tabs.includes("MuiPaper-outlined"));
});

test("newly saved orders navigate to their editor without a separate success view", async () => {
  const source = await readFile(
    new URL("../src/orders/OrderCreatePage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    source,
    /if \(orderNumber === undefined\) \{\s*onDirtyChange\(false\);\s*navigate\(`\/edit\/\$\{body\.data\.orderNumber\}`\);/u,
  );
  assert.doesNotMatch(
    source,
    /setSaved|if \(saved\)|Zur Auftragsübersicht|onSaved/u,
  );
});

test("admin shell uses a restrained brand in a persistent sidebar", async () => {
  const source = await readFile(
    new URL("../src/components/AdminShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /Auftragsverwaltung/u);
  assert.match(source, /variant=\{isMobile \? "temporary" : "permanent"\}/u);
  assert.match(source, /EXPANDED_SIDEBAR_WIDTH = 264/u);
  assert.ok(source.includes('"& .MuiDivider-root": { mx: 2 }'));
});

test("sidebar can collapse on desktop and mobile and keeps navigation accessible", async () => {
  const source = await readFile(
    new URL("../src/components/AdminShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /COLLAPSED_SIDEBAR_WIDTH = 72/u);
  assert.match(
    source,
    /aria-label=\{sidebarCollapsed \? "Seitenleiste ausklappen" : "Seitenleiste einklappen"\}/u,
  );
  assert.match(
    source,
    /onClick=\{\(\) => setSidebarCollapsed\(\(collapsed\) => !collapsed\)\}/u,
  );
  assert.match(source, /aria-label="Aufträge"/u);
  assert.match(source, /title="Abmelden" aria-label="Abmelden"/u);
  assert.match(
    source,
    /width: \{ md: `calc\(100% - \$\{sidebarWidth\}px\)` \}, ml: \{ md: `\$\{sidebarWidth\}px` \}/u,
  );
});

test("sidebar navigation starts with consistent spacing after the brand", async () => {
  const source = await readFile(
    new URL("../src/components/AdminShell.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /<Divider \/>\s*<List disablePadding>/u);
  const ordersNavigationItem = source.slice(
    source.indexOf('aria-label="Aufträge"'),
    source.indexOf('aria-label="Rechnungen"'),
  );
  assert.ok(ordersNavigationItem.includes('primary="Aufträge"'));
  assert.doesNotMatch(ordersNavigationItem, /<Divider/u);
});

test("all content navigation entries have matching icons", async () => {
  const source = await readFile(
    new URL("../src/components/AdminShell.tsx", import.meta.url),
    "utf8",
  );
  for (const [section, icon] of [
    ["offers", "LocalOfferOutlined"],
    ["prices", "PaymentsOutlined"],
    ["packings", "Inventory2Outlined"],
    ["services", "HandymanOutlined"],
    ["categories", "CategoryOutlined"],
    ["furniture", "ChairOutlined"],
  ]) {
    assert.ok(source.includes(`section: "${section}", icon: <${icon} />`));
  }
  assert.match(
    source,
    /<ListItemIcon sx=\{\{ minWidth: 36 \}\}>\{item\.icon\}<\/ListItemIcon>/u,
  );
  assert.ok(
    source.includes("<ListItemIcon><ViewModuleOutlined /></ListItemIcon>"),
  );
  assert.ok(
    source.includes(
      '{!sidebarCollapsed && <ListItemText primary="Content" />}',
    ),
  );
});

test("archived orders offer PDF and restoration without editing", async () => {
  const source = await readFile(
    new URL("../src/orders/OrdersPage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(source, /archived \? order\.orderNumber : <Button/u);
  assert.match(source, /if \(!archived &&/u);
  assert.match(source, /aria-label="Auftrags-PDF herunterladen"/u);
  assert.match(source, /aria-label="Auftrag wiederherstellen"/u);
  const editor = await readFile(
    new URL("../src/orders/OrderCreatePage.tsx", import.meta.url),
    "utf8",
  );
  assert.match(
    editor,
    /if \(body\.data\.archivedAt\) \{ navigate\("\/orders\/archived"\); return; \}/u,
  );
});

test("customer cards stack on mobile and place notes beside customer details on desktop", () => {
  const html = render(
    createElement(CustomerTab, { value: createEmptyOrder(), update: () => {} }),
  );
  assert.match(html, /grid-template-columns:minmax\(0, 1fr\)/u);
  assert.match(
    html,
    /@media \(min-width:900px\)[^}]*grid-template-columns:repeat\(2, minmax\(0, 1fr\)\)/u,
  );
  assert.match(html, /grid-row:span 2/u);
  assert.equal([...html.matchAll(/MuiPaper-outlined/gu)].length, 3);
  assert.doesNotMatch(html, /max-width:760px/u);
});

test("order cards use responsive columns without squeezing list controls", () => {
  const value = createEmptyOrder();
  const addresses = render(
    createElement(AddressesTab, {
      value,
      update: () => {},
      onDetailsChange: () => {},
    }),
  );
  assert.equal([...addresses.matchAll(/MuiGrid-grid-md-6/gu)].length, 2);
  const furniture = render(
    createElement(FurnitureTab, {
      value,
      update: () => {},
      onFurnitureChange: () => {},
    }),
  );
  assert.match(
    furniture,
    /@media \(min-width:1200px\)[^}]*grid-template-columns:minmax\(0, 1fr\) minmax\(0, 2fr\)/u,
  );
  assert.equal([...furniture.matchAll(/MuiGrid-grid-sm-6/gu)].length, 2);
  const extras = render(
    createElement(ExtrasTab, { value, onExtrasChange: () => {} }),
  );
  assert.match(extras, /MuiGrid-grid-md-4/u);
  assert.match(extras, /MuiGrid-grid-md-8/u);
  const basis = render(
    createElement(BasisTab, {
      value,
      update: () => {},
      onBasisChange: () => {},
    }),
  );
  assert.equal([...basis.matchAll(/MuiGrid-grid-md-6/gu)].length, 2);
  const conditions = render(
    createElement(ConditionsTab, { value, onConditionsChange: () => {} }),
  );
  assert.match(
    conditions,
    /@media \(min-width:900px\)[^}]*grid-template-columns:minmax\(0, 1fr\) minmax\(0, 2fr\)/u,
  );
});

test("staff can view but cannot edit the customer alternative date range", () => {
  const html = render(
    createElement(AppointmentFields, {
      value: {
        movingDate: "2026-11-01",
        movingTime: "10:00",
        dateFrom: "2026-11-02",
        dateTo: "2026-11-04",
        dateFixed: false,
      },
      onChange: () => {},
    }),
  );
  const inputs = [...html.matchAll(/<input\b[^>]*>/gu)].map(
    (match) => match[0],
  );
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

test("conditions keep manual editing and expose an explicit server calculation action", () => {
  const value = createEmptyOrder();
  value.details.conditions = [
    { description: "Manuelle Kondition", amount: 125 },
  ];
  const html = render(
    createElement(ConditionsTab, {
      value,
      onConditionsChange: () => {},
      onCalculate: () => {},
    }),
  );
  assert.ok(html.includes("Konditionen serverseitig berechnen"));
  assert.ok(html.includes("Beschreibung"));
  assert.ok(html.includes("Betrag (€)"));
  assert.ok(html.includes("Manuelle Kondition"));
  assert.ok(html.includes("125,00"));
});
