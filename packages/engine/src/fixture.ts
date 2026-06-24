import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, Intent, Report } from "@aee/core";
import { collectEvidence, defaultCaptureObservers, runAxe } from "@aee/playwright";
import { test as base, expect } from "@playwright/test";
import { judgeRun } from "./index.js";

export interface AeeFixture {
  /** Capture a checkpoint on the current page: naming evidence + the axe floor. */
  checkpoint(name: string, opts?: { intent?: Intent }): Promise<void>;
  /** All evidence captured so far across checkpoints. */
  evidence(): EvidenceRecord[];
  /** Judge everything captured (axe floor + AI quality) into a report. */
  report(): Promise<Report>;
}

/**
 * Drop-in replacement for '@playwright/test' that augments your existing tests with AEE.
 * Call `await aee.checkpoint(name, { intent })` at meaningful states, then
 * `await aee.report()` to get a judged accessibility report (deterministic axe floor +
 * AI quality). The report runs on whatever model the AI layer is configured with — local
 * by default (set AEE_LLM_PROVIDER=local), no API key.
 */
export const test = base.extend<{ aee: AeeFixture }>({
  aee: async ({ page }, use) => {
    const observers = defaultCaptureObservers();
    const collected: EvidenceRecord[] = [];
    const aee: AeeFixture = {
      async checkpoint(name, opts) {
        const naming = await collectEvidence(page, observers, { name, intent: opts?.intent });
        const axe = await runAxe(page);
        collected.push(...naming, ...axe);
      },
      evidence() {
        return [...collected];
      },
      async report() {
        return judgeRun(collected, createAIClient());
      },
    };
    await use(aee);
  },
});

export { expect };
