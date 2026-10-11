import assert from "node:assert/strict";
import * as React from "react";
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import test from "node:test";
import { ProfilePage, ProfileSubmitButton, RecoveryCodesPanel } from "../src/profile/ProfilePage.js";
import type { StaffUser } from "../src/types.js";

test("profile uses three visible cards without tabs and keeps separate forms and a plain-text name", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const user: StaffUser = {
      id: "test-user",
      name: "root_user",
      email: "test@example.test",
      role: "Admin",
      mustChangePassword: false,
      twoFactorEnabled: true,
      blocked: false,
    };
    const html = renderToStaticMarkup(createElement(ProfilePage, { user }));
    assert.match(html, /width:100%;max-width:760px;margin-left:auto;margin-right:auto/u);
    assert.doesNotMatch(html, /role="tab(?:list|panel)?"/u);
    assert.equal([...html.matchAll(/<section\b/gu)].length, 3);
    assert.equal([...html.matchAll(/<form\b/gu)].length, 3);
    for (const heading of ["Profil", "Passwort", "OTP-Einstellungen"]) {
      assert.match(html, new RegExp(`<h2[^>]*>${heading}</h2>`, "u"));
    }
    assert.match(html, /Neues Passwort wiederholen/u);
    assert.doesNotMatch(html, /Mindestens 8 Zeichen, inklusive Großbuchstabe, Kleinbuchstabe und Zahl\./u);
    assert.match(html, /padding-top:8px/u);
    assert.match(html, /Codes neu erzeugen/u);
    assert.doesNotMatch(html, /aria-label="Codes herunterladen"/u);
    assert.match(html, /<dt[^>]*>Name<\/dt>/u);
    assert.match(html, /<dd[^>]*>root_user<\/dd>/u);
    assert.doesNotMatch(html, /<input[^>]*value="root_user"/u);
    assert.match(html, /<dt[^>]*>Rolle<\/dt>/u);
    assert.match(html, /<dd[^>]*>Admin<\/dd>/u);
    assert.doesNotMatch(html, /<input[^>]*value="Admin"/u);
    assert.ok(html.indexOf(">root_user</dd>") < html.indexOf(">Rolle</dt>"));
    assert.ok(html.indexOf(">Admin</dd>") < html.indexOf("<form"));
    assert.match(html, /<input[^>]*type="email"[^>]*value="test@example.test"/u);
    for (const hint of ["Für die Änderung", "Sitzungen laufen", "Das neue Passwort", "Wiederherstellungscodes sind einmalig"]) {
      assert.match(html, new RegExp(`<p class="[^"]*MuiTypography-body2[^"]*">${hint}`, "u"));
    }
    for (const label of ["E-Mail-Adresse ändern", "Passwort ändern", "Codes neu erzeugen"]) {
      const button = html.match(new RegExp(`<button\\b[^>]*class="([^"]+)"[^>]*aria-label="${label}"`, "u"));
      assert.ok(button);
      const buttonClass = button[1]?.split(" ").find((className) => className.startsWith("css-"));
      assert.ok(buttonClass);
      assert.ok(html.includes(`.${buttonClass}{`));
      assert.match(html.slice(html.indexOf(`.${buttonClass}{`), html.indexOf("}", html.indexOf(`.${buttonClass}{`))), /align-self:flex-end/u);
    }
    assert.equal([...html.matchAll(/aria-hidden="true"[^>]*>E-Mail-Adresse ändern<\/span>/gu)].length, 3);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("profile buttons preserve the longest-label size during loading and stay within their container", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(ProfileSubmitButton, { label: "Passwort ändern", busy: true }));
    assert.match(html, /aria-hidden="true"[^>]*>E-Mail-Adresse ändern<\/span>/u);
    assert.match(html, /visibility:hidden/u);
    assert.match(html, /width:max-content;max-width:100%/u);
    assert.match(html, /role="progressbar"/u);
    assert.match(html, /<button[^>]*disabled=""/u);
    assert.match(html, /aria-label="Passwort ändern"/u);
    const disabled = renderToStaticMarkup(createElement(ProfileSubmitButton, { label: "Codes neu erzeugen", busy: false, disabled: true }));
    assert.match(disabled, /<button[^>]*disabled=""/u);
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});

test("recovery codes panel contains a download icon only when codes are available", () => {
  const previous = Reflect.get(globalThis, "React");
  Reflect.set(globalThis, "React", React);
  try {
    const html = renderToStaticMarkup(createElement(RecoveryCodesPanel, {
      codes: ["AAAAA-11111", "BBBBB-22222"],
      onDownload: () => {},
    }));
    assert.match(html, /<h3[^>]*>Wiederherstellungscodes<\/h3>/u);
    assert.match(html, /<button[^>]*type="button"[^>]*aria-label="Codes herunterladen"/u);
    assert.match(html, /data-testid="FileDownloadOutlinedIcon"/u);
    assert.match(html, /<code[^>]*>AAAAA-11111<\/code>/u);
    assert.match(html, /<code[^>]*>BBBBB-22222<\/code>/u);
    assert.doesNotMatch(html, /<form\b/u);
    assert.equal(renderToStaticMarkup(createElement(RecoveryCodesPanel, {
      codes: [],
      onDownload: () => {},
    })), "");
  } finally {
    if (previous === undefined) Reflect.deleteProperty(globalThis, "React");
    else Reflect.set(globalThis, "React", previous);
  }
});