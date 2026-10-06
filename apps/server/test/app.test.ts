import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

test("healthcheck has security/request-id headers and obeys the CORS allowlist", async (context) => {
  const app = createApp(loadConfig({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "test-only-secret-for-vega-auth-tests-32-chars",
    CORS_ALLOWED_ORIGINS: "https://www.example.test",
  }));
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

test("Better Auth is mounted and protected admin APIs reject anonymous requests", async (context) => {
  const app = createApp(loadConfig({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "test-only-secret-for-vega-auth-tests-32-chars",
    BETTER_AUTH_URL: "http://localhost:3000",
    BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000,http://localhost:5173",
  }));
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => error ? reject(error) : resolve());
  }));

  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const baseUrl = `http://127.0.0.1:${address.port}`;

  const authHealth = await fetch(`${baseUrl}/api/auth/ok`);
  assert.equal(authHealth.status, 200);

  const adminSession = await fetch(`${baseUrl}/api/admin/session`);
  assert.equal(adminSession.status, 401);

  const root = await fetch(baseUrl, { redirect: "manual" });
  assert.equal(root.status, 302);
  assert.equal(root.headers.get("location"), "/login");

  const unknownPage = await fetch(`${baseUrl}/this-path-does-not-exist`, {
    headers: { Accept: "text/html" },
    redirect: "manual",
  });
  assert.equal(unknownPage.status, 404);

  const protectedApi = await fetch(`${baseUrl}/api/admin/future`);
  assert.equal(protectedApi.status, 401);

  const protectedCatalogWrite = await fetch(`${baseUrl}/api/admin/catalog/categories`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Not allowed", sort: 0 }),
  });
  assert.equal(protectedCatalogWrite.status, 401);

  const signup = await fetch(`${baseUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ name: "Public", email: "public@example.test", password: "not-a-real-password" }),
  });
  assert.notEqual(signup.status, 200);
});
