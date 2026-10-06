import assert from "node:assert/strict";
import test from "node:test";
import { loadConfig } from "../src/config.js";

const testSecret = "test-only-secret-for-vega-auth-tests-32-chars";

test("local config applies safe development defaults", () => {
  const config = loadConfig({ BETTER_AUTH_SECRET: testSecret });

  assert.equal(config.port, 3000);
  assert.equal(config.appBaseUrl.origin, "http://localhost:3000");
  assert.equal(config.betterAuthUrl.origin, "http://localhost:3000");
  assert.deepEqual(config.betterAuthTrustedOrigins, ["http://localhost:3000"]);
  assert.deepEqual(config.corsAllowedOrigins, []);
});

test("auth config requires a strong runtime secret and exact trusted origins", () => {
  assert.throws(() => loadConfig({}), /BETTER_AUTH_SECRET/);
  assert.throws(
    () => loadConfig({ BETTER_AUTH_SECRET: testSecret, BETTER_AUTH_TRUSTED_ORIGINS: "*" }),
    /Wildcard-Origin/,
  );
});

test("config rejects wildcard CORS origins", () => {
  assert.throws(
    () => loadConfig({ BETTER_AUTH_SECRET: testSecret, CORS_ALLOWED_ORIGINS: "*" }),
    /Wildcard-Origin/,
  );
});

test("production requires HTTPS and a non-empty origin allowlist", () => {
  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      APP_BASE_URL: "http://vega.example",
      BETTER_AUTH_SECRET: testSecret,
      BETTER_AUTH_TRUSTED_ORIGINS: "http://vega.example",
    }),
    /HTTPS verwenden/,
  );
  assert.throws(
    () => loadConfig({
      NODE_ENV: "production",
      APP_BASE_URL: "https://vega.example",
      BETTER_AUTH_SECRET: testSecret,
      BETTER_AUTH_URL: "https://vega.example",
      BETTER_AUTH_TRUSTED_ORIGINS: "https://vega.example",
    }),
    /CORS_ALLOWED_ORIGINS/,
  );
});
