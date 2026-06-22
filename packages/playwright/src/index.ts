import type { ArtifactRef, Driver, Intent, Observer } from "@aee/core";
import { groundingObservers } from "@aee/observers";
import { test as base, expect } from "@playwright/test";

export interface CheckpointOptions {
  /** Plain-language purpose used to ground AI judgments (AI-first input). */
  intent?: Intent;
}

export interface Aee {
  /** Capture an accessibility checkpoint. No-op in the scaffold. */
  checkpoint(name: string, opts?: CheckpointOptions): Promise<void>;
}

/** Observers attached to a run by default. */
export const defaultObservers: Observer[] = groundingObservers;

/**
 * Playwright implementation of the Driver seam. Stub: methods throw until
 * Phase 2 wires real capture via the Playwright page + CDP session.
 */
export class PlaywrightDriver implements Driver {
  async eval<T = unknown>(_expression: string): Promise<T> {
    throw new Error("PlaywrightDriver.eval not implemented (scaffold stub).");
  }
  async screenshot(_selector?: string): Promise<ArtifactRef> {
    throw new Error("PlaywrightDriver.screenshot not implemented (scaffold stub).");
  }
  async snapshotDom(): Promise<unknown> {
    throw new Error("PlaywrightDriver.snapshotDom not implemented (scaffold stub).");
  }
  async snapshotA11yTree(): Promise<unknown> {
    throw new Error("PlaywrightDriver.snapshotA11yTree not implemented (scaffold stub).");
  }
  async extractImage(_selector: string): Promise<ArtifactRef> {
    throw new Error("PlaywrightDriver.extractImage not implemented (scaffold stub).");
  }
  async computedStyle(_selector: string): Promise<Record<string, string>> {
    throw new Error("PlaywrightDriver.computedStyle not implemented (scaffold stub).");
  }
  async focusedElement(): Promise<string | null> {
    throw new Error("PlaywrightDriver.focusedElement not implemented (scaffold stub).");
  }
}

/**
 * Drop-in replacement for '@playwright/test' that adds an `aee` fixture.
 * Mode A: import this `test` instead of '@playwright/test'.
 * Mode B: call `await aee.checkpoint(name, { intent })` for richer evidence.
 * The checkpoint is a no-op in the scaffold (no evidence is collected yet).
 */
export const test = base.extend<{ aee: Aee }>({
  aee: async ({ page }, use) => {
    void page; // Phase 2: attach defaultObservers to this page; collect on checkpoint
    const aee: Aee = {
      async checkpoint(_name: string, _opts?: CheckpointOptions): Promise<void> {
        // no-op stub
      },
    };
    await use(aee);
  },
});

export { expect };
