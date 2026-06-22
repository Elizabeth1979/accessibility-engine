import assert from "node:assert/strict";
import { test } from "node:test";
import { SCHEMA_VERSION } from "@aee/core";
import { NAMING_FIXTURES, createAIClient, enforceIntegrity, fixedModel } from "./index.js";

test("a FAIL assessment maps to a verdict that surfaces the suggested fix", async () => {
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "Accessible name 'button' is generic.",
      suggestedFix: "Open cart drawer",
    }),
  });
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("icon button"));
  assert.ok(fixture);
  const verdict = await ai.judge("accessible-name", fixture.evidence, fixture.intent);
  assert.equal(verdict.verdict, "FAIL");
  assert.equal(verdict.reliability, "authoritative");
  assert.equal(verdict.suggestedFix, "Open cart drawer");
  assert.ok(verdict.evidenceRefs.length > 0);
});

test("no evidence yields advisory UNKNOWN — never a guessed PASS", async () => {
  const ai = createAIClient({
    model: fixedModel({ verdict: "PASS", confidence: "high", reason: "should not be reached" }),
  });
  const verdict = await ai.judge("accessible-name", []);
  assert.equal(verdict.verdict, "UNKNOWN");
  assert.equal(verdict.reliability, "advisory");
});

test("integrity guard downgrades an advisory PASS to UNKNOWN", () => {
  const guarded = enforceIntegrity({
    schemaVersion: SCHEMA_VERSION,
    verdict: "PASS",
    reliability: "advisory",
    confidence: "high",
    reason: "captions look fine",
    evidenceRefs: [],
  });
  assert.equal(guarded.verdict, "UNKNOWN");
});
