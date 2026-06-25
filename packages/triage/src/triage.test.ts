import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { test } from "node:test";
import type { Verdict } from "@aee/core";
import { buildReport } from "@aee/reporter";
import { ask, loadRun, startTriageServer } from "./index.js";

const altFinding: Verdict = {
  status: "FAIL",
  confidence: "high",
  reliability: "authoritative",
  reason: "alt 'image' is generic",
  evidenceRefs: ["i1"],
  suggestedFix: "Red wool winter coat",
  target: { selector: "#coat", role: "image", name: "image" },
};

// Write a persisted run (as the engine does) into a fresh AEE_STORE_DIR-style directory.
function persistRun(): string {
  const dir = mkdtempSync(join(tmpdir(), "aee-triage-"));
  mkdirSync(join(dir, "runs"), { recursive: true });
  writeFileSync(join(dir, "runs", "run-1.json"), JSON.stringify({ id: "run-1", report: buildReport([altFinding]), evidence: [] }));
  writeFileSync(join(dir, "runs", ".latest"), "run-1");
  return dir;
}

test("ask() answers from the evidence-grounded AI layer", async () => {
  const answer = await ask("Why did the cart button fail?");
  assert.equal(typeof answer.answer, "string");
  assert.ok(Array.isArray(answer.evidenceRefs));
});

test("the triage server renders the report and answers questions over HTTP", async () => {
  const report = buildReport([
    {
      status: "FAIL",
      confidence: "high",
      reliability: "authoritative",
      reason: "alt 'image' is generic",
      evidenceRefs: ["i1"],
      suggestedFix: "Red wool winter coat",
      target: { selector: "#coat", role: "image", name: "image" },
    },
  ]);
  const server = await startTriageServer({ report, evidence: [] });
  try {
    const page = await (await fetch(server.url)).text();
    assert.match(page, /chat with your report/i);
    assert.match(page, /alt 'image' is generic/); // the report is rendered into the page

    const res = await fetch(`${server.url}ask`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question: "what failed?" }),
    });
    const answer = (await res.json()) as { answer: string; evidenceRefs: unknown[] };
    assert.equal(typeof answer.answer, "string");
    assert.ok(Array.isArray(answer.evidenceRefs));
  } finally {
    await server.close();
  }
});

test("loadRun reads the latest persisted run from a store directory", () => {
  const dir = persistRun();
  const run = loadRun(dir);
  assert.equal(run?.id, "run-1");
  assert.equal(run?.report.findings.length, 1);
  assert.equal(loadRun(dir, "missing"), undefined); // a missing id resolves to undefined, not a crash
});

test("the triage server loads a persisted run and renders findings as accessible HTML", async () => {
  const server = await startTriageServer({ storeDir: persistRun() });
  try {
    const page = await (await fetch(server.url)).text();
    assert.match(page, /class="badge fail"/); // status shown as a text badge, not colour alone
    assert.match(page, /alt 'image' is generic/); // the grounded reason
    assert.match(page, /Red wool winter coat/); // the suggested fix is surfaced
    assert.match(page, /#coat/); // the target element
    assert.match(page, /aria-live/); // answers are announced to assistive tech
  } finally {
    await server.close();
  }
});
