import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("locked packages use the public npm registry without credentials", () => {
  const lock = JSON.parse(readFileSync(new URL("../../../package-lock.json", import.meta.url), "utf8")) as {
    packages: Record<string, { link?: boolean; resolved?: string }>;
  };

  for (const [path, entry] of Object.entries(lock.packages)) {
    if (!entry.resolved || entry.link) continue;
    const url = new URL(entry.resolved);
    assert.equal(url.origin, "https://registry.npmjs.org", path);
    assert.equal(url.username, "", path);
    assert.equal(url.password, "", path);
  }
});
