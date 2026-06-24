import assert from "node:assert/strict";
import { test } from "node:test";
import type { Clock, Driver } from "@aee/core";
import { createScreenReaderObserver, screenReaderTranscript } from "./index.js";

const STOREFRONT = `<!DOCTYPE html><html><body><main>
  <h1>Checkout</h1>
  <button aria-label="Open cart">🛒</button>
  <a href="/more">Read more</a>
</main></body></html>`;

// jsdom + the virtual screen reader run in pure Node (no browser), so these are not gated.
test("screenReaderTranscript speaks the roles and accessible names a SR user would hear", async () => {
  const transcript = await screenReaderTranscript(STOREFRONT);
  // The point: the icon button's accessible NAME is spoken, not its glyph.
  assert.ok(transcript.includes("heading, Checkout, level 1"), JSON.stringify(transcript));
  assert.ok(transcript.includes("button, Open cart"));
  assert.ok(transcript.includes("link, Read more"));
  assert.ok(transcript.includes("end of document")); // a full single traversal
});

const fakeDriver = (html: string): Driver => ({
  async eval<T>() {
    return undefined as T;
  },
  async screenshot() {
    return { id: "sha256:x" };
  },
  async snapshotDom() {
    return html;
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

test("the screen-reader observer captures a transcript via the driver", async () => {
  const observer = createScreenReaderObserver();
  await observer.init({ driver: fakeDriver(STOREFRONT), clock: { now: () => 42 } as Clock });
  const records = await observer.collect(
    { id: "sr-1", type: "load", at: 0 },
    { interactionId: "sr-1", opensAt: 0 },
  );
  assert.equal(records.length, 1);
  assert.equal(records[0]?.observer, "screen-reader");
  assert.equal(records[0]?.at, 42);
  const after = records[0]?.after as { kind: string; transcript: string[]; itemCount: number };
  assert.equal(after.kind, "screen-reader");
  assert.ok(after.transcript.includes("button, Open cart"));
  assert.equal(after.itemCount, after.transcript.length);
});

test("the screen-reader observer degrades to no evidence without a driver", async () => {
  const observer = createScreenReaderObserver();
  const records = await observer.collect(
    { id: "sr-1", type: "load", at: 0 },
    { interactionId: "sr-1", opensAt: 0 },
  );
  assert.deepEqual(records, []);
});
