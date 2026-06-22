import { existsSync } from "node:fs";
import type { EvidenceRecord, Intent, Interaction, Observer } from "@aee/core";
import { createNamingObserver, groundingObservers } from "@aee/observers";
import { type Page, chromium } from "@playwright/test";
import { createClock } from "./clock.js";
import { PlaywrightDriver } from "./driver.js";

let interactionCounter = 0;

/**
 * Run observers over the current page state and return the captured evidence.
 * Each observer is isolated: a failure contributes no records (downstream → UNKNOWN)
 * and never throws. This is the one place the page seam is wired to the observers.
 */
export async function collectEvidence(
  page: Page,
  observers: Observer[],
  opts: { name?: string; intent?: Intent } = {},
): Promise<EvidenceRecord[]> {
  const driver = new PlaywrightDriver(page);
  const clock = createClock();
  const ctx = { driver, clock, intent: opts.intent };
  interactionCounter += 1;
  const interaction: Interaction = {
    id: `${opts.name ?? "checkpoint"}-${interactionCounter}`,
    type: "load",
    at: clock.now(),
  };
  const evidenceWindow = { interactionId: interaction.id, opensAt: interaction.at };
  const records: EvidenceRecord[] = [];
  for (const observer of observers) {
    try {
      await observer.init(ctx);
      await observer.beforeInteraction(interaction);
      records.push(...(await observer.collect(interaction, evidenceWindow)));
    } catch {
      // observer isolation: no evidence on failure, never a crash
    } finally {
      await observer.dispose().catch(() => {});
    }
  }
  return records;
}

/** Observers used by default: real naming capture + the (still-stub) grounding set. */
export function defaultCaptureObservers(): Observer[] {
  return [createNamingObserver(), ...groundingObservers];
}

/**
 * Convenience: launch headless Chromium, render the given HTML, and capture evidence.
 * Keeps all Playwright usage inside @aee/playwright, so callers (e.g. the MCP server,
 * later) can capture from an HTML string without taking a Playwright dependency.
 */
export async function captureHtml(
  html: string,
  opts: { name?: string; intent?: Intent } = {},
): Promise<EvidenceRecord[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    return await collectEvidence(page, defaultCaptureObservers(), opts);
  } finally {
    await browser.close();
  }
}

/** Whether a Chromium binary is available, so callers/tests can skip when it isn't. */
export function chromiumAvailable(): boolean {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}
