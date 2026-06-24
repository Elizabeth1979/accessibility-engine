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

test("explain() answers from evidence and cites the records it used", async () => {
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("icon button"));
  assert.ok(fixture);
  const ai = createAIClient({
    model: fixedModel(
      { verdict: "FAIL", confidence: "high", reason: "n/a" },
      "fixed",
      "The cart button's accessible name is 'button', which is generic.",
    ),
  });
  const answer = await ai.explain("Why did the cart button fail?", fixture.evidence);
  assert.match(answer.answer, /generic|button/i);
  assert.ok(answer.evidenceRefs.length > 0);
  assert.equal(answer.confidence, "medium");
});

test("a vision evidence screenshot is passed to the model as an image", async () => {
  let receivedImages = 0;
  let promptHadBase64 = false;
  const ai = createAIClient({
    model: {
      name: "vision-fake",
      assess: async (_system, user, images) => {
        receivedImages = images?.length ?? 0;
        promptHadBase64 = user.includes("AAAA"); // the base64 must NOT leak into the text prompt
        return { verdict: "FAIL", confidence: "high", reason: "relies on color alone", suggestedFix: "add a text label" };
      },
      answer: async () => "",
    },
  });
  const evidence = [
    {
      schemaVersion: SCHEMA_VERSION,
      interactionId: "v1",
      at: 0,
      observer: "vision",
      before: null,
      after: { kind: "color-alone", context: "required field marked red only", screenshot: "AAAA", mediaType: "image/png" },
      changes: [],
      confidence: "high" as const,
      source: "observed" as const,
    },
  ];
  const verdict = await ai.judge("color-alone", evidence);
  assert.equal(receivedImages, 1); // the screenshot reached the model as an image
  assert.equal(promptHadBase64, false); // and did not pollute the text prompt
  assert.equal(verdict.verdict, "FAIL");
});
