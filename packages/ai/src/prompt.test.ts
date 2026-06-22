import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, buildSystemPrompt, buildUserPrompt } from "./index.js";

test("system prompt encodes context-quality judging and the UNKNOWN integrity rule", () => {
  const system = buildSystemPrompt("alt-text");
  assert.match(system, /context/i);
  assert.match(system, /UNKNOWN/);
  assert.match(system, /suggestedFix/);
});

test("user prompt is grounded strictly in the provided evidence and intent", () => {
  const fixture = NAMING_FIXTURES.find((f) => f.label.includes("icon button"));
  assert.ok(fixture);
  const user = buildUserPrompt(fixture.evidence, fixture.intent);
  assert.match(user, /cart/i); // from declared intent + image description
  assert.match(user, /"accessibleName":"button"/); // serialized evidence, verbatim
  assert.match(user, /intent/i);
});
