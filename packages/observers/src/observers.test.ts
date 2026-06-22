import assert from "node:assert/strict";
import { test } from "node:test";
import type { Clock, Driver } from "@aee/core";
import { createNamingObserver, groundingObservers } from "./index.js";

test("stub observers collect no evidence (degrade to UNKNOWN, never PASS)", async () => {
  assert.ok(groundingObservers.length > 0);
  for (const obs of groundingObservers) {
    const records = await obs.collect(
      { id: "i1", type: "load", at: 0 },
      { interactionId: "i1", opensAt: 0 },
    );
    assert.deepEqual(records, []);
  }
});

// A fake Driver returns what an in-page scan would find, so the observer's
// mapping (candidate -> EvidenceRecord) is proven deterministically, no browser.
const fakeDriver = (candidates: unknown): Driver => ({
  async eval<T>() {
    return candidates as T;
  },
  async screenshot() {
    return { id: "sha256:x" };
  },
  async snapshotDom() {
    return "";
  },
  async snapshotA11yTree() {
    return "";
  },
  async extractImage() {
    return { id: "sha256:x" };
  },
  async computedStyle() {
    return {};
  },
  async focusedElement() {
    return null;
  },
});

test("the naming observer maps captured elements to grounded evidence records", async () => {
  const driver = fakeDriver([
    { selector: "#hero", kind: "image", accessibleName: "image", context: "Winter coats — Red wool coat" },
    { selector: "#cart", kind: "icon-button", accessibleName: "button", context: "Header — cart" },
  ]);
  const clock: Clock = { now: () => 123 };

  const observer = createNamingObserver();
  await observer.init({ driver, clock });
  const records = await observer.collect(
    { id: "cp-1", type: "load", at: 0 },
    { interactionId: "cp-1", opensAt: 0 },
  );

  assert.equal(records.length, 2);
  const img = records[0];
  assert.ok(img);
  assert.equal(img.observer, "naming");
  assert.equal(img.source, "observed");
  assert.equal(img.interactionId, "cp-1");
  assert.equal(img.at, 123); // stamped by the run clock, not the candidate
  assert.deepEqual(img.after, {
    kind: "image",
    accessibleName: "image",
    context: "Winter coats — Red wool coat",
    selector: "#hero",
  });
  const btn = records[1];
  assert.ok(btn);
  assert.equal((btn.after as { kind: string }).kind, "icon-button");
});

test("the naming observer degrades to no evidence when the page scan fails", async () => {
  const driver: Driver = {
    ...fakeDriver([]),
    async eval<T>(): Promise<T> {
      throw new Error("page is gone");
    },
  };
  const observer = createNamingObserver();
  await observer.init({ driver, clock: { now: () => 0 } });
  const records = await observer.collect(
    { id: "cp-1", type: "load", at: 0 },
    { interactionId: "cp-1", opensAt: 0 },
  );
  assert.deepEqual(records, []);
});
