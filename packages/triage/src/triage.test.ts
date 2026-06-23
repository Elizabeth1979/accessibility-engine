import assert from "node:assert/strict";
import { test } from "node:test";
import { buildReport } from "@aee/reporter";
import { ask, startTriageServer } from "./index.js";

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
