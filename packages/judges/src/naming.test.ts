import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, createAIClient, fixedModel } from "@aee/ai";
import { altTextJudge, formLabelJudge, linkTextJudge } from "./index.js";

// Proves the judge → AI client → verdict path end to end, with no browser:
// the judge consumes captured evidence, delegates to the (faked) AI layer, and
// surfaces a graded verdict plus a concrete suggested fix.
test("altTextJudge flags a meaningless alt and surfaces a better one", async () => {
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "alt text 'image' is generic and does not describe the coat",
      suggestedFix: "Red wool knee-length winter coat, shown on a model",
    }),
  });
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("meaningless"));
  assert.ok(fixture);

  const verdict = await altTextJudge.judge(fixture.evidence, ai, {
    concern: "alt-text",
    intent: fixture.intent,
  });

  assert.equal(verdict.status, "FAIL");
  assert.equal(verdict.reliability, "authoritative");
  assert.match(verdict.suggestedFix ?? "", /winter coat/i);
});

test("linkTextJudge flags vague link text and surfaces a better one", async () => {
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "'Read more' is not descriptive out of context",
      suggestedFix: "Read our wool winter coat care guide",
    }),
  });
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("vague link"));
  assert.ok(fixture);
  const verdict = await linkTextJudge.judge(fixture.evidence, ai, {
    concern: "link-text",
    intent: fixture.intent,
  });
  assert.equal(verdict.status, "FAIL");
  assert.match(verdict.suggestedFix ?? "", /care guide/i);
});

test("formLabelJudge flags a placeholder-only field and surfaces a label", async () => {
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "a placeholder is not a programmatic label",
      suggestedFix: "Email address",
    }),
  });
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("placeholder"));
  assert.ok(fixture);
  const verdict = await formLabelJudge.judge(fixture.evidence, ai, {
    concern: "form-label",
    intent: fixture.intent,
  });
  assert.equal(verdict.status, "FAIL");
  assert.match(verdict.suggestedFix ?? "", /email/i);
});
