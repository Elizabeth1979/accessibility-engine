// Architecture guard: the package dependency graph encodes AEE's core invariants.
// These checks fail CI if a boundary is ever broken.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { test } from "node:test";
import { fileURLToPath } from "node:url";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const deps = (pkg) => {
  const json = JSON.parse(readFileSync(resolve(root, "packages", pkg, "package.json"), "utf8"));
  return Object.keys(json.dependencies ?? {});
};

test("@aee/ai depends only on @aee/core (AI sees evidence only, never the live page)", () => {
  assert.deepEqual(deps("ai").sort(), ["@aee/core"]);
});

test("@aee/judges never imports a driver or the live page", () => {
  const d = deps("judges");
  assert.ok(!d.includes("@aee/playwright"), "judges must not depend on @aee/playwright");
  assert.ok(!d.includes("@aee/observers"), "judges must not depend on @aee/observers");
});

test("@aee/core depends only on zod", () => {
  assert.deepEqual(deps("core").sort(), ["zod"]);
});
