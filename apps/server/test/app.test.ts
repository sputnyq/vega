import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

test("healthcheck has security/request-id headers and obeys the CORS allowlist", async (context) => {
  const app = createApp(loadConfig({ CORS_ALLOWED_ORIGINS: "https://www.example.test" }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const response = await fetch(`http://127.0.0.1:${address.port}/health`, {
    headers: { Origin: "https://www.example.test" },
  });

  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: "ok", service: "vega" });
  assert.equal(response.headers.get("access-control-allow-origin"), "https://www.example.test");
  assert.ok(response.headers.get("x-request-id"));
  assert.ok(response.headers.get("content-security-policy"));

  const deniedResponse = await fetch(`http://127.0.0.1:${address.port}/health`, {
    headers: { Origin: "https://untrusted.example" },
  });
  assert.equal(deniedResponse.status, 200);
  assert.equal(deniedResponse.headers.get("access-control-allow-origin"), null);
});
