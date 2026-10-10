import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { once } from "node:events";
import test from "node:test";
import { hashPassword } from "better-auth/crypto";
import { orderPdfFixture } from "../order-pdf-fixture.js";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl || !/^\/[a-zA-Z0-9_]+_test$/u.test(new URL(testUrl).pathname)) {
  throw new Error("TEST_DATABASE_URL must select a separate database ending in _test.");
}
process.env.DATABASE_URL = testUrl;
const { prisma } = await import("../../src/prisma.js");
const { createApp } = await import("../../src/app.js");
const { loadConfig } = await import("../../src/config.js");
const { orderRelationCreates } = await import("../../src/orders/order-relations.js");

test("Admin and Kundenberater export current saved orders with auth gates, attachment headers and journal entries", async (context) => {
  const fixture = orderPdfFixture();
  const orderId = randomUUID();
  const userIds: string[] = [];
  const order = await prisma.order.create({
    data: {
      id: orderId, orderNumber: fixture.orderNumber, customerName: "Ada Beispiel", customerPhone: fixture.data.customer.phone,
      source: "check24", data: JSON.parse(JSON.stringify(fixture.data)), ...orderRelationCreates(fixture.data),
    },
  });
  const server = createApp(loadConfig({
    NODE_ENV: "test", BETTER_AUTH_SECRET: "pdf-test-only-auth-secret-with-at-least-32-characters",
    BETTER_AUTH_URL: "http://localhost:3000", BETTER_AUTH_TRUSTED_ORIGINS: "http://localhost:3000",
  })).listen(0, "127.0.0.1");
  await once(server, "listening");
  const address = server.address();
  assert.ok(address && typeof address !== "string");
  const base = `http://127.0.0.1:${address.port}`;
  context.after(async () => {
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
    await prisma.order.delete({ where: { id: orderId } });
    await prisma.user.deleteMany({ where: { id: { in: userIds } } });
    await prisma.$disconnect();
  });
  const path = `/api/admin/orders/${order.orderNumber}/pdf`;
  assert.equal((await fetch(`${base}${path}`)).status, 401);
  const password = "Pdf-test-only-password1";
  for (const role of ["Admin", "Kundenberater"]) {
    const id = randomUUID();
    userIds.push(id);
    await prisma.user.create({ data: {
      id, role, name: `PDF ${role}`, email: `${id}@example.test`,
      accounts: { create: { id: randomUUID(), accountId: id, providerId: "credential", password: await hashPassword(password) } },
    } });
    const signedIn = await fetch(`${base}/api/auth/sign-in/email`, {
      method: "POST", headers: { "Content-Type": "application/json", Origin: "http://localhost:3000" },
      body: JSON.stringify({ email: `${id}@example.test`, password }),
    });
    assert.equal(signedIn.status, 200);
    const cookie = signedIn.headers.getSetCookie().map((entry) => entry.split(";")[0]).join("; ");
    const headers = { Cookie: cookie };
    assert.equal((await fetch(`${base}${path}`, { headers })).status, 403);
    await prisma.user.update({ where: { id }, data: { twoFactorEnabled: true, mustChangePassword: true } });
    assert.equal((await fetch(`${base}${path}`, { headers })).status, 403);
    await prisma.user.update({ where: { id }, data: { mustChangePassword: false } });
    const response = await fetch(`${base}${path}`, { headers });
    assert.equal(response.status, 200);
    assert.equal(response.headers.get("Cache-Control"), "no-store");
    assert.equal(response.headers.get("Content-Type"), "application/pdf");
    assert.ok(response.headers.get("Content-Disposition")?.includes("24.10.2026_Beispiel_1042_3%2B2x3.5_4_Std_1xHVZ.pdf"));
    const pdf = Buffer.from(await response.arrayBuffer());
    assert.equal(pdf.subarray(0, 4).toString(), "%PDF");
    const events = await prisma.orderActivityEvent.findMany({ where: { orderId, action: "PDF_EXPORTED", actorName: `PDF ${role}` } });
    assert.equal(events.length, 1);
    assert.equal((await fetch(`${base}/api/admin/orders/not-a-number/pdf`, { headers })).status, 404);
    assert.equal((await fetch(`${base}/api/admin/orders/999999/pdf`, { headers })).status, 404);
    assert.equal(await prisma.orderActivityEvent.count({ where: { orderId, actorName: `PDF ${role}` } }), 1);
    const updatedData = structuredClone(fixture.data);
    updatedData.note = `Saved state for ${role}`;
    await prisma.order.update({ where: { id: orderId }, data: { data: JSON.parse(JSON.stringify(updatedData)) } });
    const fresh = await fetch(`${base}${path}`, { headers });
    assert.ok(Buffer.from(await fresh.arrayBuffer()).toString("latin1").includes(`Saved state for ${role}`));
    await prisma.order.update({ where: { id: orderId }, data: { data: { invalid: true } } });
    const failed = await fetch(`${base}${path}`, { headers });
    assert.equal(failed.status, 500);
    assert.ok(!failed.headers.get("Content-Disposition"));
    assert.equal(await prisma.orderActivityEvent.count({ where: { orderId, actorName: `PDF ${role}` } }), 2);
    await prisma.order.update({ where: { id: orderId }, data: { data: JSON.parse(JSON.stringify(updatedData)) } });
    await prisma.user.update({ where: { id }, data: { blocked: true } });
    assert.equal((await fetch(`${base}${path}`, { headers })).status, 403);
  }
});
