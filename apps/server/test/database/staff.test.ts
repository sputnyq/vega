import assert from "node:assert/strict";
import { createHash, createHmac, randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { hashPassword, verifyPassword } from "better-auth/crypto";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^\/[a-zA-Z0-9_]+_test$/u.test(new URL(testUrl).pathname)) {
  throw new Error("TEST_DATABASE_URL must select a separate database ending in _test.");
}
process.env.DATABASE_URL = testUrl;
const { prisma } = await import("../../src/prisma.js");
const { createApp } = await import("../../src/app.js");
const { loadConfig } = await import("../../src/config.js");
const { createAuth } = await import("../../src/auth-config.js");
const { changeStaff, StaffError } = await import("../../src/staff/staff-service.js");
const { recoverSoleAdmin } = await import("../../src/staff/admin-recovery.js");

function totp(uri: string) {
  const secret = new URL(uri).searchParams.get("secret");
  assert.ok(secret);
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
  const bits = [...secret.toUpperCase()].map((character) => alphabet.indexOf(character).toString(2).padStart(5, "0")).join("");
  const key = Buffer.from(Array.from({ length: Math.floor(bits.length / 8) }, (_, i) => parseInt(bits.slice(i * 8, i * 8 + 8), 2)));
  const counter = Buffer.alloc(8);
  counter.writeBigUInt64BE(BigInt(Math.floor(Date.now() / 30_000)));
  const mac = createHmac("sha1", key).update(counter).digest();
  const offset = mac[mac.length - 1]! & 15;
  return String((mac.readUInt32BE(offset) & 0x7fffffff) % 1_000_000).padStart(6, "0");
}
function object(value: unknown): asserts value is Record<string, unknown> {
  assert.ok(typeof value === "object" && value !== null && !Array.isArray(value));
}

test("A3 real auth lifecycle: provisioning, password/TOTP gates, recovery, role enforcement and session revocation", async (context) => {
  const ids: string[] = [];
  const password = "Test-only-admin-password1";
  const adminId = randomUUID();
  const secret = "test-only-a3-secret-with-more-than-32-characters";
  const rateKeys = new Set<string>();
  const authKeys = new Set<string>();
  function trackRateKey() {
    const bucket = new Date(Math.floor(Date.now() / 60000) * 60000).toISOString();
    const actorHash = createHmac("sha256", secret).update(adminId).digest("hex");
    rateKeys.add(createHash("sha256").update(`staff-password-confirmation:${actorHash}:${bucket}`).digest("hex"));
  }
  const clearRate = () => prisma.publicApiRateLimit.deleteMany({ where: { key: { in: [...rateKeys] } } });
  ids.push(adminId);
  await prisma.user.create({ data: {
    id: adminId, name: "A3 Test Admin", email: `${adminId}@example.test`, role: "Admin",
    accounts: { create: { id: randomUUID(), accountId: adminId, providerId: "credential", password: await hashPassword(password) } },
  } });
  const config = loadConfig({
    NODE_ENV: "test", BETTER_AUTH_SECRET: secret,
    BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  });
  const app = createApp(config);
  const server = app.listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  context.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.verification.deleteMany({ where: { value: { in: ids } } });
    await prisma.user.deleteMany({ where: { id: { in: ids } } });
    await clearRate();
    await prisma.rateLimit.deleteMany({ where: { key: { in: [...authKeys] } } });
    await prisma.$disconnect();
  });
  class Client {
    cookies = new Map<string, string>();
    async request(path: string, body?: unknown, origin = "http://localhost:3000") {
      trackRateKey();
      const response = await fetch(`${base}${path}`, {
        method: body === undefined ? "GET" : "POST",
        headers: { Origin: origin, Cookie: [...this.cookies].map(([name, value]) => `${name}=${value}`).join("; "), ...(body === undefined ? {} : { "Content-Type": "application/json" }) },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      for (const cookie of response.headers.getSetCookie()) {
        const pair = cookie.split(";")[0]!;
        const separator = pair.indexOf("=");
        const name = pair.slice(0, separator), value = pair.slice(separator + 1);
        if (value) this.cookies.set(name, value); else this.cookies.delete(name);
      }
      const result: unknown = await response.json();
      object(result);
      return { status: response.status, body: result };
    }
  }
  const admin = new Client();
  assert.equal((await admin.request("/api/admin/staff")).status, 401);
  assert.equal((await admin.request("/api/auth/sign-up/email", { name: "No", email: "no@example.test", password })).status, 400);
  assert.equal((await admin.request("/api/auth/sign-in/email", { email: `${adminId}@example.test`, password })).status, 200);
  assert.equal((await admin.request("/api/admin/staff")).status, 403);
  assert.equal((await admin.request("/api/auth/two-factor/enable", { password, method: "otp" })).status, 403);
  const enrolled = await admin.request("/api/auth/two-factor/enable", { password });
  assert.equal(enrolled.status, 200);
  const uri = enrolled.body.totpURI;
  assert.equal(typeof uri, "string");
  assert.equal((await admin.request("/api/admin/staff")).status, 403);
  assert.equal((await admin.request("/api/auth/two-factor/verify-totp", { code: totp(String(uri)), trustDevice: true })).status, 403);
  assert.equal((await admin.request("/api/auth/two-factor/verify-totp", { code: totp(String(uri)), trustDevice: false })).status, 200);
  assert.equal((await admin.request("/api/auth/two-factor/disable", { password })).status, 403);
  const backup = enrolled.body.backupCodes;
  assert.ok(Array.isArray(backup) && typeof backup[0] === "string");
  const factor = await prisma.twoFactor.findFirstOrThrow({ where: { userId: adminId } });
  assert.notEqual(factor.secret, new URL(String(uri)).searchParams.get("secret"));
  assert.ok(!factor.backupCodes.includes(backup[0]));
  const session = await prisma.session.findFirstOrThrow({ where: { userId: adminId } });
  assert.ok(Math.abs(session.expiresAt.getTime() - session.createdAt.getTime() - 30 * 24 * 60 * 60 * 1000) < 5000);
  await admin.request("/api/admin/staff");
  assert.equal((await prisma.session.findUniqueOrThrow({ where: { id: session.id } })).expiresAt.getTime(), session.expiresAt.getTime());
  const listed = await admin.request("/api/admin/staff");
  assert.equal(listed.status, 200);
  object(listed.body.data);
  assert.ok(Array.isArray(listed.body.data.items));
  assert.deepEqual(Object.keys(listed.body.data.items[0]!).sort(), ["id", "name", "email", "role", "blocked", "mustChangePassword", "twoFactorEnabled", "createdAt"].sort());
  const createInput = { name: "A3 Test Advisor", email: `${randomUUID()}@example.test`, role: "Kundenberater", initialPassword: "Test-only-initial-password1" };
  assert.equal((await admin.request("/api/admin/staff", createInput)).status, 400);
  assert.equal((await admin.request("/api/admin/staff", { ...createInput, currentPassword: "wrong" })).status, 403);
  assert.equal((await admin.request("/api/admin/staff", { ...createInput, currentPassword: password }, "https://evil.example.test")).status, 403);
  const created = await admin.request("/api/admin/staff", { ...createInput, currentPassword: password });
  assert.equal(created.status, 201);
  object(created.body.data);
  const userId = String(created.body.data.id);
  ids.push(userId);
  assert.equal(created.body.data.mustChangePassword, true);
  const account = await prisma.account.findFirstOrThrow({ where: { userId, providerId: "credential" } });
  assert.equal(await verifyPassword({ hash: account.password!, password: createInput.initialPassword }), true);
  assert.notEqual(account.password, createInput.initialPassword);
  const advisor = new Client();
  assert.equal((await advisor.request("/api/auth/sign-in/email", { email: createInput.email, password: createInput.initialPassword })).status, 200);
  assert.equal((await advisor.request("/api/admin/orders")).status, 403);
  let changed = "Test-only-new-password2";
  assert.equal((await advisor.request("/api/admin/auth/initial-password", { currentPassword: createInput.initialPassword, newPassword: changed })).status, 200);
  const enrollment = await advisor.request("/api/auth/two-factor/enable", { password: changed });
  assert.equal(enrollment.status, 200);
  assert.equal((await advisor.request("/api/auth/two-factor/verify-totp", { code: totp(String(enrollment.body.totpURI)), trustDevice: false })).status, 200);
  assert.equal((await advisor.request("/api/admin/orders")).status, 200);
  assert.equal((await advisor.request("/api/admin/staff")).status, 403);
  assert.equal((await advisor.request("/api/admin/settings")).status, 403);
  assert.equal((await advisor.request("/api/admin/invoices")).status, 403);
  await advisor.request("/api/auth/update-user", { role: "Admin", blocked: true, mustChangePassword: false, twoFactorEnabled: true });
  const immutable = await prisma.user.findUniqueOrThrow({ where: { id: userId } });
  assert.equal(immutable.role, "Kundenberater");
  assert.equal(immutable.blocked, false);
  assert.equal((await advisor.request("/api/admin/staff")).status, 403);
  const csrf = await advisor.request("/api/auth/update-user", { name: "Rejected" }, "https://evil.example.test");
  assert.equal(csrf.status, 403);
  const act = (kind: string, extra = {}) => admin.request(`/api/admin/staff/${userId}/actions`, { kind, currentPassword: password, ...extra });
  assert.equal((await act("role", { role: "Admin" })).status, 200);
  assert.equal(await prisma.session.count({ where: { userId } }), 0);
  assert.equal((await advisor.request("/api/admin/orders")).status, 401);
  await clearRate();
  await prisma.verification.create({ data: { id: randomUUID(), identifier: `reset-password:${randomUUID()}`, value: userId, expiresAt: new Date(Date.now() + 60000) } });
  assert.equal((await act("block", { blocked: true })).status, 200);
  assert.equal(await prisma.verification.count({ where: { value: userId } }), 0);
  assert.notEqual((await new Client().request("/api/auth/sign-in/email", { email: createInput.email, password: changed })).status, 200);
  assert.equal((await act("block", { blocked: false })).status, 200);
  assert.equal((await act("role", { role: "Kundenberater" })).status, 200);
  await assert.rejects(changeStaff(userId, adminId, { kind: "block", blocked: true }), (error) => error instanceof StaffError && error.code === "FORBIDDEN");
  assert.equal((await advisor.request("/api/admin/staff")).status, 401);
  assert.equal((await act("reset-password")).status, 503);
  await clearRate();
  const originalFetch = globalThis.fetch;
  let failMail = false;
  let sentMails = 0;
  config.mail = { apiToken: "test-only-api-token", mailboxResourceId: "test-mailbox", apiBaseUrl: new URL("https://api.mail.hostinger.com") };
  globalThis.fetch = async (input, init) => {
    const url = new URL(input instanceof Request ? input.url : input);
    if (url.origin !== "https://api.mail.hostinger.com") return originalFetch(input, init);
    assert.equal(init?.method, "POST");
    if (failMail) return new Response(JSON.stringify({ error: "Synthetic mail failure", code: "TEST_MAIL_FAILURE" }), { status: 503 });
    const payload: unknown = JSON.parse(String(init?.body));
    object(payload);
    assert.deepEqual(payload.to, [createInput.email]);
    assert.ok(typeof payload.html === "string" && payload.html.includes("/api/auth/reset-password/"));
    assert.ok(typeof payload.text === "string" && payload.text.includes("/api/auth/reset-password/"));
    sentMails++;
    return new Response(null, { status: 204 });
  };
  context.after(() => { globalThis.fetch = originalFetch; });
  assert.equal((await act("reset-password")).status, 200);
  assert.equal(sentMails, 1);
  const reset = await prisma.verification.findFirstOrThrow({ where: { value: userId, identifier: { startsWith: "reset-password:" } }, orderBy: { createdAt: "desc" } });
  assert.ok(reset.expiresAt.getTime() - Date.now() <= 60 * 60 * 1000);
  const mailClient = new Client();
  await mailClient.request("/api/auth/sign-in/email", { email: createInput.email, password: changed });
  const advisorBackups = enrollment.body.backupCodes;
  assert.ok(Array.isArray(advisorBackups));
  assert.equal((await mailClient.request("/api/auth/two-factor/verify-backup-code", { code: advisorBackups[0], trustDevice: false })).status, 200);
  const resetBody = { token: reset.identifier.slice("reset-password:".length), newPassword: "Test-only-reset-password3" };
  assert.equal((await new Client().request("/api/auth/reset-password", resetBody)).status, 200);
  changed = resetBody.newPassword;
  assert.equal((await mailClient.request("/api/admin/orders")).status, 401);
  assert.notEqual((await new Client().request("/api/auth/reset-password", resetBody)).status, 200);
  const anonymous = new Client();
  const knownReset = await anonymous.request("/api/auth/request-password-reset", { email: createInput.email, redirectTo: "http://localhost:3000/reset-password" });
  const unknownReset = await anonymous.request("/api/auth/request-password-reset", { email: "unknown-a3@example.test", redirectTo: "http://localhost:3000/reset-password" });
  assert.deepEqual(knownReset, unknownReset);
  failMail = true;
  assert.equal((await act("reset-password")).status, 502);
  globalThis.fetch = originalFetch;
  config.mail = null;
  assert.equal((await act("reset-totp")).status, 200);
  assert.equal(await prisma.twoFactor.count({ where: { userId } }), 0);
  assert.equal((await prisma.user.findUniqueOrThrow({ where: { id: userId } })).twoFactorEnabled, false);
  const resetClient = new Client();
  assert.equal((await resetClient.request("/api/auth/sign-in/email", { email: createInput.email, password: changed })).status, 200);
  assert.equal((await resetClient.request("/api/admin/orders")).status, 403);
  await clearRate();
  assert.equal((await admin.request(`/api/admin/staff/${adminId}/actions`, { kind: "reset-totp", currentPassword: password })).status, 409);
  assert.equal((await admin.request(`/api/admin/staff/${adminId}/actions`, { kind: "block", blocked: true, currentPassword: password })).status, 409);
  await assert.rejects(changeStaff(adminId, adminId, { kind: "role", role: "Kundenberater" }), (error) => error instanceof StaffError && error.code === "SELF_LOCKOUT");
  const backupLogin = new Client();
  const challenge = await backupLogin.request("/api/auth/sign-in/email", { email: `${adminId}@example.test`, password });
  assert.equal(challenge.body.twoFactorRedirect, true);
  assert.equal((await backupLogin.request("/api/auth/two-factor/verify-backup-code", { code: backup[0], trustDevice: false })).status, 200);
  const repeat = new Client();
  await repeat.request("/api/auth/sign-in/email", { email: `${adminId}@example.test`, password });
  assert.notEqual((await repeat.request("/api/auth/two-factor/verify-backup-code", { code: backup[0], trustDevice: false })).status, 200);
  await clearRate();
  for (let i = 0; i < 5; i++) assert.equal((await admin.request("/api/admin/staff", { ...createInput, currentPassword: "wrong" })).status, 403);
  assert.equal((await admin.request("/api/admin/staff", { ...createInput, currentPassword: password })).status, 429);
  await assert.rejects(recoverSoleAdmin(userId), (error) => error instanceof StaffError && error.code === "NOT_SOLE_ADMIN");
  await recoverSoleAdmin(adminId);
  assert.equal(await prisma.session.count({ where: { userId: adminId } }), 0);
  assert.equal(await prisma.twoFactor.count({ where: { userId: adminId } }), 0);
  assert.equal((await admin.request("/api/admin/staff")).status, 401);
  const recovered = new Client();
  assert.equal((await recovered.request("/api/auth/sign-in/email", { email: `${adminId}@example.test`, password })).status, 200);
  assert.equal((await recovered.request("/api/admin/staff")).status, 403);
  await prisma.session.updateMany({ where: { userId: adminId }, data: { expiresAt: new Date(Date.now() - 1000) } });
  assert.equal((await recovered.request("/api/admin/session")).status, 401);
  const limited = createAuth({ ...config, nodeEnv: "development" });
  for (let i = 0; i < 6; i++) {
    const response = await limited.handler(new Request("http://localhost:3000/api/auth/sign-in/email", {
      method: "POST", headers: { Origin: "http://localhost:3000", "Content-Type": "application/json" },
      body: JSON.stringify({ email: `${adminId}@example.test`, password: "wrong-password" }),
    }));
    assert.equal(response.status, i < 5 ? 401 : 429);
    const rules = await prisma.rateLimit.findMany({ where: { key: { endsWith: "/sign-in/email" } } });
    for (const rule of rules) authKeys.add(rule.key);
    assert.ok(rules.length > 0);
  }
});
