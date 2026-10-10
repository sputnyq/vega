import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomUUID } from "node:crypto";
import { fileURLToPath } from "node:url";
import { promisify } from "node:util";
import test, { after } from "node:test";
import { verifyPassword } from "better-auth/crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^\/[a-zA-Z0-9_]+_test$/u.test(new URL(testUrl).pathname)) {
  throw new Error("TEST_DATABASE_URL must select a separate database ending in _test.");
}
process.env.DATABASE_URL = testUrl;
const { prisma } = await import("../../src/prisma.js");
after(() => prisma.$disconnect());
const run = promisify(execFile);
const root = fileURLToPath(new URL("../../../../", import.meta.url));

test("explicit seed is idempotent and the recovery CLI revokes only the sole admin's factors/access", async (context) => {
  assert.equal(await prisma.user.count({ where: { role: "Admin" } }), 0);
  const email = `${randomUUID()}@example.test`;
  const password = "Prisma7-test-only-bootstrap1";
  const options = {
    cwd: root, timeout: 15_000,
    env: { ...process.env, DATABASE_URL: testUrl, INITIAL_ADMIN_EMAIL: email, INITIAL_ADMIN_PASSWORD: password },
  };
  context.after(async () => {
    const user = await prisma.user.findUnique({ where: { email } });
    if (user) {
      await prisma.verification.deleteMany({ where: { value: user.id } });
      await prisma.user.delete({ where: { id: user.id } });
    }
  });
  const created = await run("npm", ["run", "db:seed"], options);
  assert.match(created.stdout, /Initial admin created/u);
  assert.equal(created.stdout.includes(email), false);
  assert.equal(created.stdout.includes(password), false);
  const user = await prisma.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } });
  assert.equal(user.name, "root_user");
  assert.equal(user.mustChangePassword, true);
  assert.equal(user.twoFactorEnabled, false);
  const hash = user.accounts[0]?.password;
  assert.ok(hash);
  assert.equal(await verifyPassword({ hash, password }), true);

  const repeated = await run("npm", ["run", "db:seed"], {
    ...options, env: { ...options.env, INITIAL_ADMIN_PASSWORD: "Different-test-only-password2" },
  });
  assert.match(repeated.stdout, /An admin already exists/u);
  const unchanged = await prisma.user.findUniqueOrThrow({ where: { email }, include: { accounts: true } });
  assert.equal(unchanged.id, user.id);
  assert.equal(unchanged.accounts[0]?.password, hash);
  assert.equal(await prisma.user.count({ where: { role: "Admin" } }), 1);

  await prisma.user.update({ where: { id: user.id }, data: { twoFactorEnabled: true } });
  const expiresAt = new Date(Date.now() + 60_000);
  await prisma.session.create({ data: { id: randomUUID(), userId: user.id, token: randomUUID(), expiresAt } });
  await prisma.verification.create({ data: { id: randomUUID(), identifier: randomUUID(), value: user.id, expiresAt } });
  await prisma.twoFactor.create({ data: { id: randomUUID(), userId: user.id, secret: "test-only-factor", backupCodes: "test-only-encrypted-payload" } });
  const recovered = await run("npm", ["run", "auth:recover-admin", "--", user.id, "--confirm-identity-and-backup"], options);
  assert.match(recovered.stdout, /widerrufen/u);
  assert.equal(await prisma.session.count({ where: { userId: user.id } }), 0);
  assert.equal(await prisma.verification.count({ where: { value: user.id } }), 0);
  assert.equal(await prisma.twoFactor.count({ where: { userId: user.id } }), 0);
  const recoveredUser = await prisma.user.findUniqueOrThrow({ where: { id: user.id }, include: { accounts: true } });
  assert.equal(recoveredUser.twoFactorEnabled, false);
  assert.equal(recoveredUser.role, "Admin");
  assert.equal(recoveredUser.accounts[0]?.password, hash);
});
