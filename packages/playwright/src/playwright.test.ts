import assert from "node:assert/strict";
import { test as nodeTest } from "node:test";
import {
  PlaywrightDriver,
  captureHtml,
  chromiumAvailable,
  defaultObservers,
  expect,
  test as aeeTest,
} from "./index.js";

nodeTest("exports an extended Playwright test + expect, driver, and default observers", () => {
  assert.equal(typeof aeeTest, "function");
  assert.equal(typeof expect, "function");
  assert.equal(typeof PlaywrightDriver, "function");
  assert.ok(defaultObservers.length > 0);
});

// Real capture runs only where a Chromium binary exists, so CI/offline stays green.
const browserSkip = chromiumAvailable() ? false : "no Chromium browser available";

const STOREFRONT = `
  <main>
    <h1>Winter coats</h1>
    <article>
      <img id="coat" alt="image"
        src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
      <p>Red wool knee-length winter coat. $129. <a id="more" href="/guide">Read more</a></p>
    </article>
    <header><button id="cart" aria-label="button">🛒</button></header>
  </main>`;

nodeTest(
  "captureHtml turns a live page into grounded naming evidence",
  { skip: browserSkip },
  async () => {
    const evidence = await captureHtml(STOREFRONT, {
      name: "storefront",
      intent: { purpose: "Clothing storefront", notes: "the cart icon opens the cart drawer" },
    });

    const img = evidence.find((e) => (e.after as { kind?: string }).kind === "image");
    const btn = evidence.find((e) => (e.after as { kind?: string }).kind === "icon-button");

    assert.ok(img, "captured the image element");
    const imgAfter = img.after as { accessibleName: string | null; context: string; selector?: string };
    assert.equal(imgAfter.accessibleName, "image"); // the meaningless alt, verbatim
    assert.match(imgAfter.context, /winter coat/i); // grounded in surrounding text
    assert.equal(imgAfter.selector, "#coat");
    assert.equal(img.observer, "naming");
    assert.equal(img.source, "observed");

    assert.ok(btn, "captured the icon-only button");
    assert.equal((btn.after as { accessibleName: string | null }).accessibleName, "button");

    const heading = evidence.find((e) => (e.after as { kind?: string }).kind === "heading");
    assert.ok(heading, "captured the heading");
    assert.equal((heading.after as { accessibleName: string | null }).accessibleName, "Winter coats");

    const link = evidence.find((e) => (e.after as { kind?: string }).kind === "link");
    assert.ok(link, "captured the link");
    assert.equal((link.after as { accessibleName: string | null }).accessibleName, "Read more");
  },
);
