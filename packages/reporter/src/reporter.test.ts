import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verdict } from "@aee/core";
import { buildReport, strictReleasePolicy } from "./index.js";

const unknown: Verdict = {
  status: "UNKNOWN",
  confidence: "low",
  reliability: "advisory",
  reason: "stub",
  evidenceRefs: [],
};

test("report counts an UNKNOWN and never converts it to PASS", () => {
  const report = buildReport([unknown], strictReleasePolicy);
  assert.equal(report.summary.unknown, 1);
  assert.equal(report.summary.pass, 0);
  assert.equal(report.release.decision, "hold");
});
