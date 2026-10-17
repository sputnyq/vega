import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ProfilePage, RecoveryCodesPanel } from "../src/profile/ProfilePage.js";
import type { StaffUser } from "../src/types.js";

test("Kundenberater can set up optional TOTP or disable it with password confirmation; admins cannot disable it", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const base: StaffUser = { id: "u", name: "Berater", email: "b@example.test", role: "Kundenberater", mustChangePassword: false, twoFactorEnabled: false, blocked: false };
    const without = renderToStaticMarkup(createElement(ProfilePage, { user: base, onSetupTotp: () => {} }));
    assert.match(without, /nicht eingerichtet \(optional\)/u);
    assert.match(without, />TOTP einrichten</u);
    assert.doesNotMatch(without, /TOTP deaktivieren/u);
    const withTotp = renderToStaticMarkup(createElement(ProfilePage, { user: { ...base, twoFactorEnabled: true }, onSetupTotp: () => {} }));
    assert.doesNotMatch(withTotp, />TOTP einrichten</u);
    assert.match(withTotp, /aria-label="TOTP deaktivieren"/u);
    assert.match(withTotp, /Aktuelles Passwort bestätigen/u);
    const admin = renderToStaticMarkup(createElement(ProfilePage, { user: { ...base, role: "Admin", twoFactorEnabled: true }, onSetupTotp: () => {} }));
    assert.doesNotMatch(admin, /TOTP deaktivieren|TOTP einrichten|optional/u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("recovery codes are shown with a download action only when codes are available", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(RecoveryCodesPanel, {
      codes: ["AAAAA-11111", "BBBBB-22222"],
      onDownload: () => {},
    }));
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Codes herunterladen"/u);
    assert.match(html, /<code[^>]*>AAAAA-11111<\/code>/u);
    assert.match(html, /<code[^>]*>BBBBB-22222<\/code>/u);
    assert.equal(renderToStaticMarkup(createElement(RecoveryCodesPanel, {
      codes: [],
      onDownload: () => {},
    })), "");
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});