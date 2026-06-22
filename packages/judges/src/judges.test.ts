import assert from "node:assert/strict";
import { test } from "node:test";
import { createAIClient } from "@aee/ai";
import { allJudges, altTextJudge } from "./index.js";

test("the alt-text judge is the Tier-1 wedge", () => {
  assert.equal(altTextJudge.tier, 1);
  assert.equal(altTextJudge.name, "alt-text");
});

test("stub judges never upgrade UNKNOWN to PASS", async () => {
  const ai = createAIClient();
  for (const judge of allJudges) {
    const verdict = await judge.judge([], ai, { concern: judge.name });
    assert.notEqual(verdict.status, "PASS");
  }
});
