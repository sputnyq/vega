import assert from "node:assert/strict";
import test from "node:test";
import { BACKUP_CODES_FILE_NAME, formatBackupCodesFile } from "../src/auth/backup-codes-file.js";

test("backup codes file lists every code on its own line", () => {
  const content = formatBackupCodesFile(["AAAAA-11111", "BBBBB-22222"], new Date("2026-10-10T10:00:00.000Z"));

  assert.match(content, /^Vega – Wiederherstellungscodes\n/);
  assert.match(content, /Erstellt: 2026-10-10T10:00:00\.000Z/);
  assert.match(content, /\nAAAAA-11111\nBBBBB-22222\n$/);
  assert.match(BACKUP_CODES_FILE_NAME, /\.txt$/);
});
