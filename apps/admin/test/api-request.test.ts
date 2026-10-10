import assert from "node:assert/strict";
import test from "node:test";
import { apiRequest } from "../src/api/api-request.js";

test("admin API requests preserve method, same-origin credentials, and optional JSON bodies", async (context) => {
  const originalFetch = globalThis.fetch;
  const calls: Array<{ input: RequestInfo | URL; init?: RequestInit }> = [];
  globalThis.fetch = async (input, init) => {
    calls.push({ input, init });
    return Response.json({ data: { saved: true } });
  };
  context.after(() => { globalThis.fetch = originalFetch; });

  assert.deepEqual(await apiRequest("/api/orders"), { saved: true });
  assert.deepEqual(await apiRequest("/api/orders/1", "PUT", { name: "Test" }), { saved: true });
  assert.deepEqual(await apiRequest("/api/orders", "POST", { name: "Test" }), { saved: true });
  assert.deepEqual(await apiRequest("/api/orders/1", "DELETE"), { saved: true });
  assert.deepEqual(calls, [
    { input: "/api/orders", init: { method: "GET", credentials: "same-origin" } },
    { input: "/api/orders/1", init: { method: "PUT", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{\"name\":\"Test\"}" } },
    { input: "/api/orders", init: { method: "POST", credentials: "same-origin", headers: { "Content-Type": "application/json" }, body: "{\"name\":\"Test\"}" } },
    { input: "/api/orders/1", init: { method: "DELETE", credentials: "same-origin" } },
  ]);
});

test("admin API requests preserve response, issue, network, and JSON error behavior", async (context) => {
  const originalFetch = globalThis.fetch;
  context.after(() => { globalThis.fetch = originalFetch; });

  globalThis.fetch = async () => Response.json({ data: { value: 1 } }, { status: 500 });
  await assert.rejects(apiRequest("/broken"), { message: "Die Kataloganfrage ist fehlgeschlagen." });

  globalThis.fetch = async () => Response.json({ error: { message: "Serverfehler" } }, { status: 400 });
  await assert.rejects(apiRequest("/broken"), { message: "Serverfehler" });

  globalThis.fetch = async () => Response.json({ error: { issues: [{ field: "name", message: "Erforderlich" }, { field: "email", message: "Ungültig" }] } }, { status: 422 });
  await assert.rejects(apiRequest("/broken"), { message: "name: Erforderlich · email: Ungültig" });

  globalThis.fetch = async () => { throw new Error("network"); };
  await assert.rejects(apiRequest("/broken"), { message: "network" });

  globalThis.fetch = async () => new Response("not-json");
  await assert.rejects(apiRequest("/broken"), SyntaxError);
});
