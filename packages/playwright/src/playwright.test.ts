import assert from "node:assert/strict";
import { test as nodeTest } from "node:test";
import { PlaywrightDriver, defaultObservers, expect, test as aeeTest } from "./index.js";

nodeTest("exports an extended Playwright test + expect and default observers", () => {
  assert.equal(typeof aeeTest, "function");
  assert.equal(typeof expect, "function");
  assert.ok(defaultObservers.length > 0);
});

nodeTest("PlaywrightDriver methods are stubs", async () => {
  const driver = new PlaywrightDriver();
  await assert.rejects(driver.snapshotDom());
  await assert.rejects(driver.focusedElement());
});
