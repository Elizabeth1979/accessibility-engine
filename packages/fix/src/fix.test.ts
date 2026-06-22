import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verdict } from "@aee/core";
import { dryRun, planFix } from "./index.js";

test("planFix builds a plan from a suggested fix and dry-runs it", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "Icon button has no meaningful name",
    evidenceRefs: ["i1"],
    suggestedFix: "Open cart drawer",
  };
  const plan = planFix(finding);
  assert.ok(plan);
  assert.equal(plan?.suggestedValue, "Open cart drawer");
  assert.match(dryRun(plan!), /Open cart drawer/);
});

test("planFix returns null when there is no suggested fix", () => {
  const finding: Verdict = {
    status: "UNKNOWN",
    confidence: "low",
    reliability: "advisory",
    reason: "no evidence",
    evidenceRefs: [],
  };
  assert.equal(planFix(finding), null);
});
