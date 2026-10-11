import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";
import type { Response } from "express";
import { clientAbortSignal, isClientAbort, ProviderUnreachableError, providerFetch } from "../src/maps/provider-request.js";

function fakeResponse(writableFinished: boolean): Response {
  return Object.assign(new EventEmitter(), { writableFinished }) as unknown as Response;
}

test("client signal aborts only when the response closes before it finished", () => {
  const open = fakeResponse(false);
  const openSignal = clientAbortSignal(open);
  (open as unknown as EventEmitter).emit("close");
  assert.equal(openSignal.aborted, true);

  const done = fakeResponse(true);
  const doneSignal = clientAbortSignal(done);
  (done as unknown as EventEmitter).emit("close");
  assert.equal(doneSignal.aborted, false);
});

test("browser disconnect aborts the upstream provider request", async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  let upstreamSignal: AbortSignal | undefined;
  globalThis.fetch = ((_url: unknown, init?: RequestInit) => new Promise((_resolve, reject) => {
    upstreamSignal = init?.signal ?? undefined;
    upstreamSignal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError")));
  })) as typeof fetch;

  const res = fakeResponse(false);
  const pending = providerFetch("https://provider.example.test", {}, clientAbortSignal(res));
  (res as unknown as EventEmitter).emit("close");
  await assert.rejects(pending, (error: unknown) => isClientAbort(error));
  assert.equal(upstreamSignal?.aborted, true);
});

test("network failures are reported as unreachable provider errors", async (context) => {
  const original = globalThis.fetch;
  context.after(() => { globalThis.fetch = original; });
  globalThis.fetch = (async () => { throw new TypeError("fetch failed"); }) as typeof fetch;
  await assert.rejects(providerFetch("https://provider.example.test", {}, new AbortController().signal), ProviderUnreachableError);
});
