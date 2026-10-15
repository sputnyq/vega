import assert from "node:assert/strict";
import test from "node:test";
import { saveAndFetchOrderPdf } from "../src/orders/order-pdf-download.js";

test("order PDF download waits for saving and preserves the server filename and bytes", async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  const calls: string[] = [];
  globalThis.fetch = async (url, init) => {
    assert.equal(url, "/api/admin/orders/1042/pdf");
    assert.equal(init?.credentials, "same-origin");
    calls.push("download");
    return new Response("%PDF-test", { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename*=UTF-8''24.10.2026_M%C3%BCller_1042.pdf" } });
  };
  const file = await saveAndFetchOrderPdf(1042, async () => { await Promise.resolve(); calls.push("save"); return true; });
  assert.deepEqual(calls, ["save", "download"]);
  assert.equal(file?.filename, "24.10.2026_Müller_1042.pdf");
  assert.equal(await file?.blob.text(), "%PDF-test");
});

test("failed saving prevents a stale PDF download", async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  globalThis.fetch = async () => { throw new Error("PDF must not be requested"); };
  assert.equal(await saveAndFetchOrderPdf(1, async () => false), null);
  await assert.rejects(saveAndFetchOrderPdf(1, async () => { throw new Error("Save failed"); }), /Save failed/u);
});

test("PDF API, session, network and invalid-response failures remain explicit", async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  const save = async () => true;
  for (const status of [401, 403, 404, 500]) {
    globalThis.fetch = async () => Response.json({ error: { message: `Server error ${status}` } }, { status });
    await assert.rejects(saveAndFetchOrderPdf(1, save), new RegExp(`Server error ${status}`, "u"));
  }
  globalThis.fetch = async () => new Response("login", { headers: { "Content-Type": "text/html" } });
  await assert.rejects(saveAndFetchOrderPdf(1, save), /kein gültiges Auftrags-PDF/u);
  globalThis.fetch = async () => new Response("%PDF", { headers: { "Content-Type": "application/pdf" } });
  await assert.rejects(saveAndFetchOrderPdf(1, save), /Dateiname fehlt/u);
  globalThis.fetch = async () => new Response("broken", { headers: { "Content-Type": "application/pdf", "Content-Disposition": "attachment; filename*=UTF-8''test.pdf" } });
  await assert.rejects(saveAndFetchOrderPdf(1, save), /kein gültiges Auftrags-PDF/u);
  globalThis.fetch = async () => { throw new Error("network failure"); };
  await assert.rejects(saveAndFetchOrderPdf(1, save), /network failure/u);
});
