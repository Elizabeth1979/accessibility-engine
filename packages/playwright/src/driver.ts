import { createHash } from "node:crypto";
import type { ArtifactRef, Driver } from "@aee/core";
import type { Page } from "@playwright/test";

/** Content-address a captured artifact so evidence references it without inlining bytes. */
export function artifactRef(bytes: Buffer, mime: string): ArtifactRef {
  const digest = createHash("sha256").update(bytes).digest("hex");
  return { id: `sha256:${digest.slice(0, 16)}`, mime, bytes: bytes.byteLength };
}

/** Computed-style properties relevant to visual a11y judgments (Tier 2+). */
const STYLE_PROPS = [
  "color",
  "background-color",
  "font-size",
  "font-weight",
  "outline",
  "outline-color",
  "display",
  "visibility",
];

/**
 * The real Driver: the only seam that touches the live Playwright page. Everything
 * downstream (observers, AI, judges) consumes the captured evidence, never the page.
 * The `evaluate` callbacks below run in the browser, so they use DOM globals.
 */
export class PlaywrightDriver implements Driver {
  readonly #page: Page;

  constructor(page: Page) {
    this.#page = page;
  }

  async eval<T = unknown>(expression: string): Promise<T> {
    // page.evaluate accepts a string expression at runtime; its typed overload is
    // function-only, so cast the argument while keeping the call bound to the page
    // (extracting the method into a variable would drop its `this` binding).
    return (await this.#page.evaluate(expression as unknown as () => T)) as T;
  }

  async screenshot(selector?: string): Promise<ArtifactRef> {
    const buf = selector
      ? await this.#page.locator(selector).screenshot()
      : await this.#page.screenshot();
    return artifactRef(buf, "image/png");
  }

  async snapshotDom(): Promise<unknown> {
    return this.#page.content();
  }

  async snapshotA11yTree(): Promise<unknown> {
    return this.#page.locator("body").ariaSnapshot();
  }

  async extractImage(selector: string): Promise<ArtifactRef> {
    const buf = await this.#page.locator(selector).screenshot();
    return artifactRef(buf, "image/png");
  }

  async computedStyle(selector: string): Promise<Record<string, string>> {
    return this.#page.locator(selector).evaluate((el, props) => {
      const cs = getComputedStyle(el as Element);
      const out: Record<string, string> = {};
      for (const p of props) out[p] = cs.getPropertyValue(p);
      return out;
    }, STYLE_PROPS);
  }

  async focusedElement(): Promise<string | null> {
    return this.#page.evaluate(() => {
      const el = document.activeElement;
      if (!el || el === document.body) return null;
      return el.id ? `#${el.id}` : el.localName;
    });
  }
}
