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

test("@aee/ai is grounded: depends on @aee/core but never on a driver or the live page", () => {
  const d = deps("ai");
  // The model SDK is allowed; reaching the live page is not. AI sees evidence only.
  assert.ok(d.includes("@aee/core"), "ai must depend on @aee/core");
  assert.ok(!d.includes("@aee/playwright"), "ai must not depend on @aee/playwright");
  assert.ok(!d.includes("@aee/observers"), "ai must not depend on @aee/observers");
});

test("@aee/judges never imports a driver or the live page", () => {
  const d = deps("judges");
  assert.ok(!d.includes("@aee/playwright"), "judges must not depend on @aee/playwright");
  assert.ok(!d.includes("@aee/observers"), "judges must not depend on @aee/observers");
});

test("@aee/core depends only on zod", () => {
  assert.deepEqual(deps("core").sort(), ["zod"]);
});

test("@aee/playwright is the DX/driver layer: it never depends on judges or the AI layer", () => {
  // The end-to-end walking-skeleton test composes capture + judge + AI at the
  // workspace-root level (a dev dependency), so the driver layer stays thin.
  const d = deps("playwright");
  assert.ok(d.includes("@aee/core"), "playwright must depend on @aee/core");
  assert.ok(d.includes("@aee/observers"), "playwright must depend on @aee/observers");
  assert.ok(!d.includes("@aee/judges"), "playwright must not depend on @aee/judges");
  assert.ok(!d.includes("@aee/ai"), "playwright must not depend on @aee/ai");
});
