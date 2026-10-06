import assert from "node:assert/strict";
import test from "node:test";
import { verifyPassword } from "better-auth/crypto";
import { ensureInitialAdmin, type InitialAdminRecord } from "../src/initial-admin.js";

const credentials = {
  INITIAL_ADMIN_EMAIL: "root@example.test",
  INITIAL_ADMIN_PASSWORD: "Test-only-initial-password1",
};

test("initial bootstrap creates a root_user Admin with a hashed, change-required password", async () => {
  let created: InitialAdminRecord | undefined;
  const result = await ensureInitialAdmin({
    hasAdmin: async () => false,
    hasEmail: async () => false,
    create: async (record) => { created = record; },
  }, credentials);

  assert.equal(result, "created");
  assert.ok(created);
  assert.equal(created.name, "root_user");
  assert.equal(created.role, "Admin");
  assert.equal(created.mustChangePassword, true);
  assert.equal(created.emailVerified, false);
  assert.notEqual(created.passwordHash, credentials.INITIAL_ADMIN_PASSWORD);
  assert.equal(await verifyPassword({ hash: created.passwordHash, password: credentials.INITIAL_ADMIN_PASSWORD }), true);
});

test("bootstrap is idempotent and does not need the bootstrap password after an admin exists", async () => {
  let createCalls = 0;
  const result = await ensureInitialAdmin({
    hasAdmin: async () => true,
    hasEmail: async () => false,
    create: async () => { createCalls += 1; },
  }, {});

  assert.equal(result, "already-exists");
  assert.equal(createCalls, 0);
});

test("seed invoked during migrations skips cleanly when bootstrap variables are absent", async () => {
  const result = await ensureInitialAdmin({
    hasAdmin: async () => false,
    hasEmail: async () => false,
    create: async () => assert.fail("Must not create an admin without bootstrap variables"),
  }, {});

  assert.equal(result, "skipped");
});

test("bootstrap rejects missing or weak initial credentials", async () => {
  const repository = {
    hasAdmin: async () => false,
    hasEmail: async () => false,
    create: async () => assert.fail("Must not create an admin with invalid credentials"),
  };

  await assert.rejects(
    ensureInitialAdmin(repository, { INITIAL_ADMIN_PASSWORD: credentials.INITIAL_ADMIN_PASSWORD }),
    /INITIAL_ADMIN_EMAIL/,
  );
  await assert.rejects(
    ensureInitialAdmin(repository, { ...credentials, INITIAL_ADMIN_PASSWORD: "shortA1" }),
    /mindestens 8 Zeichen/,
  );
  await assert.rejects(
    ensureInitialAdmin(repository, { ...credentials, INITIAL_ADMIN_PASSWORD: "lowercase1" }),
    /Großbuchstaben/,
  );
  await assert.rejects(
    ensureInitialAdmin(repository, { ...credentials, INITIAL_ADMIN_PASSWORD: "UPPERCASE1" }),
    /Kleinbuchstaben/,
  );
  await assert.rejects(
    ensureInitialAdmin(repository, { ...credentials, INITIAL_ADMIN_PASSWORD: "NoDigitsHere" }),
    /Zahl/,
  );
});
