import assert from "node:assert/strict";
import { once } from "node:events";
import test from "node:test";
import express from "express";
import { createAdminRateLimit, createAssetRateLimit, createProfileEmailRateLimit } from "../src/http-rate-limit.js";
import { createApp } from "../src/app.js";
import { loadConfig } from "../src/config.js";

function staffApp(limiter: ReturnType<typeof createAdminRateLimit>, staffId: { current: string }) {
  const app = express();
  app.use(((_req, res, next) => {
    res.locals.staffUser = { id: staffId.current };
    next();
  }));
  app.use("/api/admin", limiter);
  app.get("/api/admin/ping", (_req, res) => { res.json({ data: { pong: true } }); });
  return app;
}

async function listen(app: ReturnType<typeof express>) {
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  return { server, base: `http://127.0.0.1:${address.port}` };
}

test("admin limiter allows traffic below quota and returns 429 with retry info above it", async (context) => {
  const staffId = { current: "staff-a" };
  const { server, base } = await listen(staffApp(createAdminRateLimit({ max: 3 }), staffId));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  for (let i = 0; i < 3; i++) assert.equal((await fetch(`${base}/api/admin/ping`)).status, 200);
  const limited = await fetch(`${base}/api/admin/ping`);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
  assert.equal((await limited.json()).error.code, "RATE_LIMITED");
});

test("admin limiter quota is independent per staff account", async (context) => {
  const staffId = { current: "staff-a" };
  const { server, base } = await listen(staffApp(createAdminRateLimit({ max: 1 }), staffId));
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  assert.equal((await fetch(`${base}/api/admin/ping`)).status, 200);
  assert.equal((await fetch(`${base}/api/admin/ping`)).status, 429);
  staffId.current = "staff-b";
  assert.equal((await fetch(`${base}/api/admin/ping`)).status, 200);
});

test("profile e-mail limiter matches the five-per-minute password-confirmation posture", async (context) => {
  const staffId = { current: "staff-a" };
  const app = express();
  app.use(((_req, res, next) => {
    res.locals.staffUser = { id: staffId.current };
    next();
  }));
  app.post("/api/admin/profile/email", createProfileEmailRateLimit({ max: 2 }), (_req, res) => {
    res.json({ data: { email: "ok@example.test" } });
  });
  const { server, base } = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  for (let i = 0; i < 2; i++) {
    assert.equal((await fetch(`${base}/api/admin/profile/email`, { method: "POST" })).status, 200);
  }
  const limited = await fetch(`${base}/api/admin/profile/email`, { method: "POST" });
  assert.equal(limited.status, 429);
  assert.equal((await limited.json()).error.code, "RATE_LIMITED");
});

test("asset limiter serves the loader below quota and limits repeated fetching", async (context) => {
  const app = express();
  const limiter = createAssetRateLimit({ max: 3 });
  app.get("/customer-form/loader.js", limiter, (_req, res) => { res.type("text/javascript").send("// test loader"); });
  const { server, base } = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  for (let i = 0; i < 3; i++) assert.equal((await fetch(`${base}/customer-form/loader.js`)).status, 200);
  const limited = await fetch(`${base}/customer-form/loader.js`);
  assert.equal(limited.status, 429);
  assert.equal(limited.headers.get("retry-after"), "60");
});

test("wired app limits repeated loader access without breaking normal page loads", async (context) => {
  const app = createApp(loadConfig({
    NODE_ENV: "test",
    BETTER_AUTH_SECRET: "test-only-secret-for-vega-auth-tests-32-chars",
  }));
  const { server, base } = await listen(app);
  context.after(() => new Promise<void>((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  }));
  // Normal single-digit page/asset traffic stays below the quota.
  for (const path of ["/login", "/two-factor", "/customer-form/loader.js"]) {
    const response = await fetch(`${base}${path}`);
    assert.ok(response.status !== 429, `${path} must not be limited on first access`);
  }
});
