import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, createAIClient, fixedModel } from "@aee/ai";
import { type EvidenceRecord, SCHEMA_VERSION } from "@aee/core";
import { chromiumAvailable } from "@aee/playwright";
import { investigate, judgeEvidence } from "./index.js";

// Deterministic: routing + per-element judging, no browser and no real model.
test("judgeEvidence routes each evidence kind to its concern and skips unroutable records", async () => {
  const ai = createAIClient({
    model: fixedModel({ verdict: "FAIL", confidence: "high", reason: "x", suggestedFix: "better" }),
  });
  const pick = (needle: string): EvidenceRecord => {
    const fixture = NAMING_FIXTURES.find((f) => f.label.includes(needle));
    assert.ok(fixture, `fixture matching "${needle}"`);
    const record = fixture.evidence[0];
    assert.ok(record);
    return record;
  };
  const evidence: EvidenceRecord[] = [
    pick("meaningless"), // image -> alt-text
    pick("vague link"), // link -> link-text
    pick("Section 2"), // heading -> heading-structure
    {
      schemaVersion: SCHEMA_VERSION,
      interactionId: "unroutable",
      at: 0,
      observer: "naming",
      before: null,
      after: null, // no kind -> skipped
      changes: [],
      confidence: "high",
      source: "observed",
    },
  ];

  const verdicts = await judgeEvidence(evidence, ai);
  assert.equal(verdicts.length, 3, "one verdict per routable element, unroutable skipped");
  assert.ok(verdicts.every((v) => v.status === "FAIL"));
  assert.ok(verdicts.every((v) => (v.suggestedFix ?? "").length > 0));
});

// Live end-to-end: a real page, real local model. Gated on Chromium + a local server.
const BASE_URL = process.env.AEE_LLM_BASE_URL ?? "http://localhost:11434/v1";
async function localModelReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${BASE_URL}/models`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

let skip: false | string = false;
if (!chromiumAvailable()) skip = "no Chromium browser available";
else if (!(await localModelReachable())) skip = "no local model server reachable";

test("investigate: live HTML -> a multi-concern report on the local model", { skip }, async () => {
  const html = `
    <main>
      <h1>Winter coats</h1>
      <article>
        <img id="coat" alt="image"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <p>Red wool knee-length winter coat. $129. <a id="more" href="/guide">Read more</a></p>
      </article>
      <header><button id="cart" aria-label="button">🛒</button></header>
      <form><label for="email">Email address</label><input id="email" type="email" /></form>
    </main>`;

  const run = await investigate(
    { html, intent: { purpose: "Clothing storefront" } },
    { ai: createAIClient({ provider: "local" }) },
  );

  // Five element types captured and judged; the bad names should fail with a fix.
  assert.ok(run.report.summary.total >= 4, `expected several findings, got ${run.report.summary.total}`);
  assert.ok(
    run.report.findings.some((v) => v.status === "FAIL" && (v.suggestedFix ?? "").length > 0),
    "at least one failing verdict with a concrete suggested fix",
  );
  assert.match(run.id, /^run-/);
});
