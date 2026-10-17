import assert from "node:assert/strict";
import test from "node:test";
import { legacyGoogleKeyVariables, loadConfig } from "../src/config.js";

test("pre-consolidation Google variables are reported by name only", () => {
  assert.deepEqual(
    legacyGoogleKeyVariables({
      GOOGLE_PLACES_API_KEY: "secret-value",
      GOOGLE_MAPS_API_KEY: "x",
    }),
    ["GOOGLE_PLACES_API_KEY"],
  );
  assert.deepEqual(
    legacyGoogleKeyVariables({
      GOOGLE_PLACES_API_KEY: "a",
      GOOGLE_ROUTES_API_KEY: "b",
    }),
    ["GOOGLE_PLACES_API_KEY", "GOOGLE_ROUTES_API_KEY"],
  );
  assert.deepEqual(
    legacyGoogleKeyVariables({ GOOGLE_ROUTES_API_KEY: " " }),
    [],
  );
  assert.deepEqual(legacyGoogleKeyVariables({}), []);
});

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
    () =>
      loadConfig({
        BETTER_AUTH_SECRET: testSecret,
        BETTER_AUTH_TRUSTED_ORIGINS: "*",
      }),
    /Wildcard-Origin/,
  );
});

test("trusted origins accept explicit localhost origins with development ports", () => {
  const origins =
    "http://localhost:3000,http://localhost:5173,http://localhost:5176";
  const config = loadConfig({
    BETTER_AUTH_SECRET: testSecret,
    BETTER_AUTH_TRUSTED_ORIGINS: origins,
  });

  assert.deepEqual(config.betterAuthTrustedOrigins, origins.split(","));
});

test("config rejects wildcard CORS origins", () => {
  assert.throws(
    () =>
      loadConfig({ BETTER_AUTH_SECRET: testSecret, CORS_ALLOWED_ORIGINS: "*" }),
    /Wildcard-Origin/,
  );
});

test("mail credentials are paired and the Hostinger API endpoint remains HTTPS", () => {
  assert.throws(
    () =>
      loadConfig({
        BETTER_AUTH_SECRET: testSecret,
        HOSTINGER_MAIL_API_TOKEN: "token-only",
      }),
    /gemeinsam gesetzt/,
  );
  assert.throws(
    () =>
      loadConfig({
        BETTER_AUTH_SECRET: testSecret,
        HOSTINGER_MAIL_API_TOKEN: "token",
        HOSTINGER_MAILBOX_RESOURCE_ID: "mailbox",
        HOSTINGER_MAIL_API_BASE_URL: "http://mail.example.test",
      }),
    /HTTPS-URL/,
  );
});

test("production requires HTTPS and a non-empty origin allowlist", () => {
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        APP_BASE_URL: "http://vega.example",
        BETTER_AUTH_SECRET: testSecret,
        BETTER_AUTH_TRUSTED_ORIGINS: "http://vega.example",
      }),
    /HTTPS verwenden/,
  );
  assert.throws(
    () =>
      loadConfig({
        NODE_ENV: "production",
        APP_BASE_URL: "https://vega.example",
        BETTER_AUTH_SECRET: testSecret,
        BETTER_AUTH_URL: "https://vega.example",
        BETTER_AUTH_TRUSTED_ORIGINS: "https://vega.example",
      }),
    /CORS_ALLOWED_ORIGINS/,
  );
});
