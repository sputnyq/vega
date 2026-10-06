import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

test("local config applies safe development defaults", () => {
  const config = loadConfig({});

  assert.equal(config.port, 3000);
  assert.equal(config.appBaseUrl.origin, "http://localhost:3000");
  assert.deepEqual(config.corsAllowedOrigins, []);
});

test("config rejects wildcard CORS origins", () => {
  assert.throws(
    () => loadConfig({ CORS_ALLOWED_ORIGINS: "*" }),
    /Wildcard-Origin/,
  );
});

test("production requires HTTPS and a non-empty origin allowlist", () => {
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", APP_BASE_URL: "http://vega.example" }),
    /HTTPS verwenden/,
  );
  assert.throws(
    () => loadConfig({ NODE_ENV: "production", APP_BASE_URL: "https://vega.example" }),
    /CORS_ALLOWED_ORIGINS/,
  );
});
