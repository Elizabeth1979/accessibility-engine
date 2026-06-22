// To adopt AEE, swap the import — everything else is your existing Playwright test.
import { expect, test } from "@aee/playwright"; // was: '@playwright/test'

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
});
