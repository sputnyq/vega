import assert from "node:assert/strict";
import { createElement } from "react";
import test from "node:test";
import { mount } from "./dom-test-helpers.js";
import { loadStaffAccounts, staffAccountActions, UserManagementPage } from "../src/settings/UserManagementPage.js";

test("user management uses separate name and email table columns", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => Response.json({ data: { items: [{
    id: "test-admin", name: "Test Admin", email: "admin@example.test", role: "Admin",
    blocked: false, mustChangePassword: false, twoFactorEnabled: true,
  }], total: 1 } });
  const app = await mount(createElement(UserManagementPage, { currentUserId: "test-admin" }));
  try {
    const row = app.container.querySelector("tbody tr")!;
    const cells = [...row.querySelectorAll("td")];
    assert.match(row.textContent ?? "", /Aktiv/u);
    assert.equal(cells[1]!.textContent, "Test Admin");
    assert.equal(cells[2]!.textContent, "admin@example.test");
    await app.click(row.querySelector('button[aria-haspopup="menu"]')!);
    const items = [...app.window.document.querySelectorAll('[role="menuitem"]')];
    assert.deepEqual(items.map((item) => item.textContent), ["Als Kundenberater setzen", "Sperren", "Passwort-Reset-Mail", "2FA zurücksetzen"]);
    assert.deepEqual(items.map((item) => item.getAttribute("aria-disabled") === "true"), [true, true, false, true]);
  } finally { globalThis.fetch = originalFetch; await app.cleanup(); }
});

test("staff action menu preserves account actions and prevents self-account changes", () => {
  const own = staffAccountActions({ id: "admin", role: "Admin", blocked: false }, "admin");
  assert.deepEqual(own, [
    { label: "Als Kundenberater setzen", action: { kind: "role", role: "Kundenberater" }, disabled: true },
    { label: "Sperren", action: { kind: "block", blocked: true }, disabled: true },
    { label: "Passwort-Reset-Mail", action: { kind: "reset-password" }, disabled: false },
    { label: "2FA zurücksetzen", action: { kind: "reset-totp" }, disabled: true },
  ]);
  const other = staffAccountActions({ id: "advisor", role: "Kundenberater", blocked: true }, "admin");
  assert.ok(other.every((item) => !item.disabled));
  assert.deepEqual(other[0], { label: "Als Admin setzen", action: { kind: "role", role: "Admin" }, disabled: false });
  assert.deepEqual(other[1], { label: "Entsperren", action: { kind: "block", blocked: false }, disabled: false });
});

test("user management loads every account without a search filter", async () => {
  const originalFetch = globalThis.fetch;
  try {
    for (const total of [0, 3, 27]) {
      const accounts = Array.from({ length: total }, (_, index) => ({ id: `staff-${index}` }));
      const calls: string[] = [];
      globalThis.fetch = async (url) => {
        calls.push(String(url));
        const offset = (calls.length - 1) * 25;
        return Response.json({ data: { items: accounts.slice(offset, offset + 25), total } });
      };
      assert.deepEqual(await loadStaffAccounts(), accounts);
      assert.deepEqual(calls, total > 25 ? ["/api/admin/staff", "/api/admin/staff?page=2"] : ["/api/admin/staff"]);
    }
  } finally {
    globalThis.fetch = originalFetch;
  }
});

test("user management stops if the API cannot return the remaining accounts", async () => {
  const originalFetch = globalThis.fetch;
  try {
    globalThis.fetch = async () => Response.json({ data: { items: [], total: 1 } });
    await assert.rejects(loadStaffAccounts(), /nicht vollständig geladen/u);
  } finally {
    globalThis.fetch = originalFetch;
  }
});