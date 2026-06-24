import { existsSync } from "node:fs";
import {
  type EvidenceRecord,
  type FocusPayload,
  type Intent,
  type Interaction,
  type Observer,
  SCHEMA_VERSION,
} from "@aee/core";
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

/**
 * Capture a single interaction's focus behaviour: focus the trigger, activate it, and
 * record where focus lands plus any live-region announcement. The result is a
 * "focus-change" record the engine routes to the focus-management concern (Tier 3).
 */
export async function captureInteraction(
  html: string,
  opts: { trigger: string; name?: string; intent?: Intent },
): Promise<EvidenceRecord[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const driver = new PlaywrightDriver(page);
    const clock = createClock();

    await page.focus(opts.trigger).catch(() => {});
    const focusBefore = await driver.focusedElement();
    await page.click(opts.trigger);
    await page.waitForTimeout(80); // let focus / DOM settle after the activation
    const focusAfter = await driver.focusedElement();
    const announcement =
      (await driver.eval<string>(`(${readAnnouncement.toString()})()`)) || undefined;

    interactionCounter += 1;
    const after: FocusPayload = {
      kind: "focus-change",
      trigger: opts.trigger,
      focusBefore,
      focusAfter,
      announcement,
    };
    return [
      {
        schemaVersion: SCHEMA_VERSION,
        interactionId: `${opts.name ?? "interaction"}-${interactionCounter}`,
        at: clock.now(),
        observer: "interaction",
        before: { focused: focusBefore },
        after,
        changes: [],
        confidence: "high",
        source: "observed",
      },
    ];
  } finally {
    await browser.close();
  }
}

// Runs in the browser (serialized via toString). Reads what assistive tech would announce.
function readAnnouncement(): string {
  const regions = document.querySelectorAll("[aria-live], [role=alert], [role=status]");
  let text = "";
  regions.forEach((region) => {
    text += ` ${region.textContent ?? ""}`;
  });
  return text.replace(/\s+/g, " ").trim();
}

/** Whether a Chromium binary is available, so callers/tests can skip when it isn't. */
export function chromiumAvailable(): boolean {
  try {
    return existsSync(chromium.executablePath());
  } catch {
    return false;
  }
}
