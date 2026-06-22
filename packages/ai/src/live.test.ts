import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, createAIClient } from "./index.js";

// Live end-to-end against Claude. Skipped unless ANTHROPIC_API_KEY is set, so
// CI and offline builds stay green. Run with the key to exercise real judging.
const skip = process.env.ANTHROPIC_API_KEY ? false : "ANTHROPIC_API_KEY not set";

for (const fixture of NAMING_FIXTURES) {
  test(`live: ${fixture.label}`, { skip }, async () => {
    const ai = createAIClient();
    const verdict = await ai.judge("accessible-name", fixture.evidence, fixture.intent);
    if (fixture.expect === "PASS") {
      assert.equal(verdict.verdict, "PASS", verdict.reason);
    } else {
      assert.notEqual(verdict.verdict, "PASS", verdict.reason);
      assert.ok(
        verdict.suggestedFix && verdict.suggestedFix.length > 0,
        "a non-PASS verdict should propose a concrete better name",
      );
    }
  });
}
