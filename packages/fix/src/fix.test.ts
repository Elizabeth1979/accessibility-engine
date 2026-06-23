import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verdict } from "@aee/core";
import { dryRun, planFix, planFixes, proposePr } from "./index.js";

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

test("planFix targets the element and picks the attribute by kind", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "Icon button named 'button'",
    evidenceRefs: ["i1"],
    suggestedFix: "Open cart drawer",
    target: { selector: "#cart", role: "icon-button", name: "button" },
  };
  const plan = planFix(finding);
  assert.ok(plan);
  assert.equal(plan?.change.path, "aria-label"); // icon-button -> aria-label
  assert.equal(plan?.target.selector, "#cart");
  assert.equal(plan?.change.before, "button");
  assert.match(dryRun(plan!), /#cart/);
  assert.match(dryRun(plan!), /aria-label/);
});

test("proposePr builds a gh PR scaffold from fix plans (dry-run, not executed)", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "alt 'image' is generic",
    evidenceRefs: ["i1"],
    suggestedFix: "Red wool winter coat",
    target: { selector: "#coat", role: "image", name: "image" },
  };
  const pr = proposePr(planFixes([finding]));
  assert.match(pr.title, /1 accessibility fix\b/);
  assert.ok(pr.commands.some((c) => c.startsWith("gh pr create")));
  assert.match(pr.body, /Red wool winter coat/);
  assert.match(pr.body, /alt/); // the attribute being set
});
