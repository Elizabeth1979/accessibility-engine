import assert from "node:assert/strict";
import { test } from "node:test";
import { createAIClient } from "./index.js";

test("stub AI judge returns advisory UNKNOWN, never PASS", async () => {
  const ai = createAIClient();
  const j = await ai.judge("alt-text", []);
  assert.equal(j.verdict, "UNKNOWN");
  assert.equal(j.reliability, "advisory");
  assert.notEqual(j.verdict, "PASS");
});
