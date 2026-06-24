// To adopt AEE, swap the import — everything else is your existing Playwright test.
import { expect, test } from "@aee/engine/test"; // was: '@playwright/test'

test("checkout is accessible", async ({ page, aee }) => {
  await page.goto("/checkout");

  // Optional: declare intent so AEE's AI judges this page in context.
  await aee.checkpoint("checkout-loaded", {
    intent: {
      purpose: "Checkout",
      primaryAction: "Pay",
      notes: "the cart icon button opens the cart drawer",
    },
  });

  await expect(page.getByRole("button", { name: /pay/i })).toBeVisible();

  // A judged accessibility report: the deterministic axe floor + AI quality, on the
  // local model by default (set AEE_LLM_PROVIDER=local). Fail the test on a hard block.
  const report = await aee.report();
  expect(report.release.decision).not.toBe("block");
});
