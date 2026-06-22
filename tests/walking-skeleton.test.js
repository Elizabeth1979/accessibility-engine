import assert from "node:assert/strict";
import { test } from "node:test";
import { createAIClient, fixedModel } from "@aee/ai";
import { altTextJudge } from "@aee/judges";
import { captureHtml, chromiumAvailable } from "@aee/playwright";

// End-to-end walking skeleton, in one process: a live page -> real captured
// evidence -> a judge's verdict + suggested fix. The model is faked (deterministic)
// so this runs without an API key; the real-Claude version is in
// packages/ai/src/live.test.ts (gated on ANTHROPIC_API_KEY).
const skip = chromiumAvailable() ? false : "no Chromium browser available";

test("walking skeleton: live HTML -> capture -> judge verdict + fix", { skip }, async () => {
  const html = `
    <main>
      <h1>Winter coats</h1>
      <article>
        <img id="coat" alt="image"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <p>Red wool knee-length winter coat. $129.</p>
      </article>
    </main>`;

  // 1. Real capture: a live page becomes grounded evidence (no AI yet).
  const evidence = await captureHtml(html, {
    name: "storefront",
    intent: { purpose: "Clothing storefront" },
  });
  const imageEvidence = evidence.filter((e) => e.after && e.after.kind === "image");
  assert.equal(imageEvidence.length, 1, "captured exactly the one image");
  assert.equal(imageEvidence[0].after.accessibleName, "image");

  // 2. Judge the captured evidence. The model is faked here to keep CI deterministic;
  //    what this proves is the wiring: captured evidence flows into the judge and
  //    yields a graded verdict plus a concrete better value.
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "alt text 'image' is generic and does not describe the product",
      suggestedFix: "Red wool knee-length winter coat, shown on a model",
    }),
  });
  const verdict = await altTextJudge.judge(imageEvidence, ai, {
    concern: "alt-text",
    intent: { purpose: "Clothing storefront" },
  });

  assert.equal(verdict.status, "FAIL");
  assert.equal(verdict.reliability, "authoritative");
  assert.match(verdict.suggestedFix ?? "", /winter coat/i);
});
