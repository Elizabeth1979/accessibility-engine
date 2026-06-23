import assert from "node:assert/strict";
import { test } from "node:test";
import { createAIClient } from "@aee/ai";
import { altTextJudge } from "@aee/judges";
import { captureHtml, chromiumAvailable } from "@aee/playwright";

// The fully-real walking skeleton: a live page -> real capture -> a REAL local
// model judgment -> verdict + fix. No fakes, no API key. Skipped unless both a
// Chromium browser AND a local OpenAI-compatible model server are available, so
// CI without them stays green. (walking-skeleton.test.js proves the same wiring
// deterministically with a faked model; this proves it against a real local model.)
const BASE_URL = process.env.AEE_LLM_BASE_URL ?? "http://localhost:11434/v1";

async function localModelReachable() {
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

let skip = false;
if (!chromiumAvailable()) skip = "no Chromium browser available";
else if (!(await localModelReachable())) skip = "no local model server reachable";

test("walking skeleton (local): live HTML -> capture -> local judge -> non-PASS + fix", { skip }, async () => {
  const html = `
    <main>
      <h1>Winter coats</h1>
      <article>
        <img id="coat" alt="image"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <p>Red wool knee-length winter coat. $129.</p>
      </article>
    </main>`;

  const evidence = await captureHtml(html, {
    name: "storefront",
    intent: { purpose: "Clothing storefront" },
  });
  const imageEvidence = evidence.filter((e) => e.after && e.after.kind === "image");
  assert.equal(imageEvidence.length, 1, "captured exactly the one image");

  const ai = createAIClient({ provider: "local" });
  const verdict = await altTextJudge.judge(imageEvidence, ai, {
    concern: "alt-text",
    intent: { purpose: "Clothing storefront" },
  });

  // The captured alt is the meaningless "image"; a real local model should reject it
  // and propose something concrete — grounded only in the captured evidence.
  assert.notEqual(verdict.status, "PASS", verdict.reason);
  assert.equal(verdict.reliability, "authoritative");
  assert.ok(
    verdict.suggestedFix && verdict.suggestedFix.length > 0,
    "a non-PASS verdict should propose a concrete better alt",
  );
});
