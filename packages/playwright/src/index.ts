import type { EvidenceRecord, Intent, Observer } from "@aee/core";
import { test as base, expect } from "@playwright/test";
import { collectEvidence, defaultCaptureObservers } from "./capture.js";

export { PlaywrightDriver, artifactRef } from "./driver.js";
export { createClock } from "./clock.js";
export {
  captureHtml,
  chromiumAvailable,
  collectEvidence,
  defaultCaptureObservers,
} from "./capture.js";

export interface CheckpointOptions {
  /** Plain-language purpose used to ground AI judgments (AI-first input). */
  intent?: Intent;
}

export interface Aee {
  /** Capture an accessibility checkpoint: run observers and store the evidence. */
  checkpoint(name: string, opts?: CheckpointOptions): Promise<void>;
  /** All evidence captured by checkpoints in this test so far. */
  evidence(): EvidenceRecord[];
}

/** Observers attached to a run by default (real naming capture + grounding stubs). */
export const defaultObservers: Observer[] = defaultCaptureObservers();

/**
 * Drop-in replacement for '@playwright/test' that adds an `aee` fixture.
 * Mode A: import this `test` instead of '@playwright/test'.
 * Mode B: `await aee.checkpoint(name, { intent })` to capture grounded evidence.
 */
export const test = base.extend<{ aee: Aee }>({
  aee: async ({ page }, use) => {
    const observers = defaultCaptureObservers();
    const collected: EvidenceRecord[] = [];
    const aee: Aee = {
      async checkpoint(name, opts) {
        const records = await collectEvidence(page, observers, {
          name,
          intent: opts?.intent,
        });
        collected.push(...records);
      },
      evidence() {
        return [...collected];
      },
    };
    await use(aee);
  },
});

export { expect };
