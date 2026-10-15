import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { loadStaffAccounts, staffAccountActions, StaffAccountStatus, UserManagementPage } from "../src/settings/UserManagementPage.js";

test("user management has no search or pagination controls", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(UserManagementPage, { currentUserId: "test-admin" }));
    assert.doesNotMatch(html, /Name oder E-Mail suchen|MuiPagination|>Suchen</u);
    assert.doesNotMatch(html, /Jede Kontoaktion erfordert Ihr aktuelles Admin-Passwort/u);
    assert.match(html, />Nutzer anlegen</u);
    const createButton = html.match(/<button\b[^>]*>(?:(?!<\/button>)[\s\S])*Nutzer anlegen<\/button>/u)?.[0];
    assert.ok(createButton);
    assert.match(createButton, /MuiButton-startIcon/u);
    assert.match(createButton, /data-testid="AddOutlinedIcon"/u);
    assert.match(html, /justify-content:flex-end/u);
    assert.doesNotMatch(html, />Neu laden</u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("user management uses separate name and email table columns", async () => {
  const source = await readFile(new URL("../src/settings/UserManagementPage.tsx", import.meta.url), "utf8");
  assert.match(source, /<TableCell>Name<\/TableCell>\s*<TableCell>E-Mail<\/TableCell>/u);
  assert.match(source, /<TableCell align="center">Status<\/TableCell><TableCell>Name/u);
  assert.match(source, /<TableCell>Rolle<\/TableCell><TableCell>OTP<\/TableCell>/u);
  assert.match(source, /<TableCell><Stack spacing=\{0\.5\} sx=\{\{ alignItems: "flex-start" \}\}>/u);
  assert.match(source, /<TableCell align="center"><StaffAccountStatus blocked=\{user\.blocked\} \/><\/TableCell>\s*<TableCell>\{user\.name\}/u);
  assert.match(source, /<TableCell>\{user\.name\}<\/TableCell>\s*<TableCell>\{user\.email\}<\/TableCell>/u);
  assert.doesNotMatch(source, /Name \/ E-Mail/u);
  assert.match(source, /<MoreVert\s*\/>/u);
  assert.match(source, /aria-haspopup="menu"/u);
  assert.match(source, /<Menu id="staff-actions-menu"/u);
});

test("account status uses small badges sized to their labels", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const active = renderToStaticMarkup(createElement(StaffAccountStatus, { blocked: false }));
    assert.match(active, /MuiChip-sizeSmall/u);
    assert.match(active, />Aktiv<\/span>/u);
    assert.match(active, /MuiChip-colorSuccess/u);
    assert.match(active, /width:fit-content/u);
    const blocked = renderToStaticMarkup(createElement(StaffAccountStatus, { blocked: true }));
    assert.match(blocked, /MuiChip-sizeSmall/u);
    assert.match(blocked, />Gesperrt<\/span>/u);
    assert.match(blocked, /MuiChip-colorError/u);
    assert.match(blocked, /width:fit-content/u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
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