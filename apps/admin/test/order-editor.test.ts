import assert from "node:assert/strict";
import * as React from "react";
import test, { type TestContext } from "node:test";
import type { CreateOrderInput } from "@vega/domain";
import { mount } from "./dom-test-helpers.js";

const input: CreateOrderInput = {
  customer: { firstName: "Original", lastName: "Customer", phone: "089123456" },
  from: { street: "First street 1", postalCode: "80331", city: "Munich" },
  to: { street: "Second street 2", postalCode: "80333", city: "Munich" },
  movingDate: "2026-11-01",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
}

async function editor(context: TestContext, {
  fresh = false,
  write,
}: {
  fresh?: boolean;
  write: (body: Record<string, unknown>, method: string) => Response;
}) {
  const orderNumber = fresh ? undefined : 1000;
  context.mock.method(globalThis, "fetch", async (url: string | URL | Request, init?: RequestInit) => {
    const path = String(url);
    if (init?.method === "PUT" || init?.method === "POST") {
      return write(JSON.parse(String(init.body)) as Record<string, unknown>, init.method);
    }
    if (path === "/api/admin/orders/1000") return json({ data: { orderNumber: 1000, revision: 7, data: input, archivedAt: null, isCopy: false } });
    if (path.endsWith("/family")) return json({ data: { items: [] } });
    if (path === "/api/admin/routes/config") return json({ data: { origin: null, available: false } });
    return json({ data: [] });
  });
  const view = await mount(null);
  const previousButton = Object.getOwnPropertyDescriptor(globalThis, "HTMLButtonElement");
  Object.defineProperty(globalThis, "HTMLButtonElement", { configurable: true, value: view.window.HTMLButtonElement });
  context.after(async () => {
    await view.cleanup();
    if (previousButton) Object.defineProperty(globalThis, "HTMLButtonElement", previousButton);
    else Reflect.deleteProperty(globalThis, "HTMLButtonElement");
  });
  const { OrderCreatePage } = await import("../src/orders/OrderCreatePage.js");
  const events: string[] = [];
  function Harness() {
    const [dirty, setDirty] = React.useState(orderNumber === undefined);
    const onDirtyChange = React.useCallback((next: boolean) => { events.push(`dirty:${next}`); setDirty(next); }, []);
    const onBusyChange = React.useCallback(() => {}, []);
    const navigate = React.useCallback((path: string) => { events.push(`navigate:${path}`); }, []);
    return React.createElement(React.Fragment, null,
      React.createElement(OrderCreatePage, { navigate, onDirtyChange, onBusyChange, dirty, ...(orderNumber === undefined ? {} : { orderNumber }) }),
      React.createElement("button", { type: "submit", form: "order-create-form" }, "Save"),
      React.createElement("output", { "data-dirty": String(dirty) }),
    );
  }
  await view.render(React.createElement(Harness));
  await view.flush();
  const firstName = view.container.querySelector<HTMLInputElement>('input[autocomplete="given-name"]');
  const save = view.container.querySelector("button[form='order-create-form']");
  assert.ok(firstName && save);
  return { ...view, firstName, save, events };
}

test("order conflict keeps the edited fields, dirty state and original expected revision", async (context) => {
  const requests: Record<string, unknown>[] = [];
  const view = await editor(context, { write: (body) => {
    requests.push(body);
    return json({ error: { code: "ORDER_CONFLICT", message: "Der Auftrag wurde zwischenzeitlich geändert. Ihr Entwurf bleibt erhalten." } }, 409);
  } });
  assert.equal(view.firstName.value, "Original");
  await view.input(view.firstName, "Unsaved draft");
  assert.equal(view.container.querySelector("output")?.getAttribute("data-dirty"), "true");
  await view.click(view.save);
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.revision, 7);
  assert.equal((requests[0]!.customer as { firstName: string }).firstName, "Unsaved draft");
  assert.equal(view.firstName.value, "Unsaved draft");
  assert.equal(view.container.querySelector("output")?.getAttribute("data-dirty"), "true");
  assert.match(view.container.textContent ?? "", /Ihr Entwurf bleibt erhalten/u);
  assert.ok(!view.events.some((event) => event.startsWith("navigate:")));
  await view.click(view.save);
  assert.deepEqual(requests.map((request) => request.revision), [7, 7]);
});

test("successful order saves adopt normalized data and the returned revision for subsequent edits", async (context) => {
  const requests: Record<string, unknown>[] = [];
  const view = await editor(context, { write: (body, method) => {
    assert.equal(method, "PUT");
    requests.push(body);
    const customer = body.customer as CreateOrderInput["customer"];
    return json({ data: {
      orderNumber: 1000, revision: 7 + requests.length,
      data: { ...body, customer: { ...customer, firstName: customer.firstName.trim() } },
    } });
  } });
  await view.input(view.firstName, " Saved ");
  await view.click(view.save);
  assert.equal(view.firstName.value, "Saved");
  assert.equal(view.container.querySelector("output")?.getAttribute("data-dirty"), "false");
  await view.input(view.firstName, "Second edit");
  await view.click(view.save);
  assert.deepEqual(requests.map((request) => request.revision), [7, 8]);
  assert.equal(view.firstName.value, "Second edit");
  assert.equal(view.container.querySelector("output")?.getAttribute("data-dirty"), "false");
});

test("order creation clears dirty synchronously before navigating to the persisted editor", async (context) => {
  const requests: Record<string, unknown>[] = [];
  const view = await editor(context, { fresh: true, write: (body, method) => {
    assert.equal(method, "POST");
    requests.push(body);
    return json({ data: { orderNumber: 1012 } }, 201);
  } });
  await view.input(view.firstName, "New customer");
  await view.click(view.save);
  assert.equal(requests.length, 1);
  assert.equal("revision" in requests[0]!, false);
  const navigation = view.events.indexOf("navigate:/edit/1012");
  assert.ok(navigation > 0);
  assert.equal(view.events[navigation - 1], "dirty:false");
});
