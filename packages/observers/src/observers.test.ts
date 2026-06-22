import assert from "node:assert/strict";
import { test } from "node:test";
import { groundingObservers } from "./index.js";

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
