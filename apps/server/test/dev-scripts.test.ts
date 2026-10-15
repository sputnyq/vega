import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("all server development entry points generate Prisma and start from the root for dotenv", () => {
  const root = JSON.parse(readFileSync(new URL("../../../package.json", import.meta.url), "utf8"));
  const server = JSON.parse(readFileSync(new URL("../package.json", import.meta.url), "utf8"));

  assert.match(root.scripts.dev, /"npm:dev:server"/u);
  assert.equal(root.scripts["dev:server"], "npm run dev --workspace @vega/server");
  assert.equal(server.scripts.predev, "npm run db:generate --prefix ../..");
  assert.equal(server.scripts.dev, "cd ../.. && tsx watch apps/server/src/main.ts");
  assert.equal(root.scripts["db:generate"], "prisma generate");
});
