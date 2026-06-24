// Runnable end-to-end demo: investigate a sample storefront and print the graded report.
//
//   pnpm demo
//
// Judges on a local model when AEE_LLM_PROVIDER=local (Ollama gemma4:e4b by default);
// otherwise the AI verdicts degrade to UNKNOWN — and the deterministic axe floor still reports.
import { investigate } from "@aee/engine";
import { chromiumAvailable } from "@aee/playwright";
import { renderTerminalSummary } from "@aee/reporter";

// Four issues axe PASSES (the attribute is present) but AEE catches as wrong-in-context,
// plus one (the unlabeled input) the deterministic axe floor flags on its own.
const SAMPLE = `<!DOCTYPE html>
<html lang="en"><body><main>
  <h1>Winter Sale</h1>
  <img id="hero" src="/red-wool-coat.jpg" alt="image">
  <button id="cart" aria-label="button">🛒</button>
  <a id="more" href="/coat-care-guide">Read more</a>
  <h2 id="sec">Section 2</h2>
  <input id="email" type="email" placeholder="Email address">
</main></body></html>`;

if (!chromiumAvailable()) {
  console.error(
    "\nThis demo needs Chromium to capture the page.\n" +
      "Install it once with:  pnpm exec playwright install chromium\n",
  );
  process.exit(1);
}

const provider = process.env.AEE_LLM_PROVIDER ?? "(none)";
console.log("\nAEE demo — investigating a sample storefront\n");
console.log(
  provider === "local"
    ? "Judging on a local model (AEE_LLM_PROVIDER=local).\n"
    : `No model configured (AEE_LLM_PROVIDER=${provider}); AI verdicts will be UNKNOWN.\n` +
        "Run a local server and set AEE_LLM_PROVIDER=local to judge for real; the axe floor still reports.\n",
);

const run = await investigate({
  html: SAMPLE,
  intent: {
    purpose: "Winter clothing storefront",
    primaryAction: "Add to cart",
    notes: "the cart icon opens the cart drawer",
  },
});

console.log(renderTerminalSummary(run.report));
