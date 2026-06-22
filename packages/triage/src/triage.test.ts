import assert from "node:assert/strict";
import { test } from "node:test";
import { ask, startTriageServer } from "./index.js";

test("ask() answers from the evidence-grounded AI layer", async () => {
  const answer = await ask("Why did the cart button fail?");
  assert.equal(typeof answer.answer, "string");
  assert.ok(Array.isArray(answer.evidenceRefs));
});

test("startTriageServer is a stub for now", async () => {
  await assert.rejects(startTriageServer());
});
