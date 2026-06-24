import { existsSync } from "node:fs";
import {
  type EvidenceRecord,
  type FocusPayload,
  type Intent,
  type Interaction,
  type KeyboardPayload,
  type LiveRegionPayload,
  type Observer,
  type VisionPayload,
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

/** Focus the trigger, activate it, and observe the focus / DOM / announcement outcome. */
async function performInteraction(page: Page, driver: PlaywrightDriver, trigger: string) {
  await page.focus(trigger).catch(() => {});
  const focusBefore = await driver.focusedElement();
  const domBefore = String(await driver.snapshotDom());
  await page.click(trigger);
  await page.waitForTimeout(80); // let focus / DOM settle after the activation
  const focusAfter = await driver.focusedElement();
  const domAfter = String(await driver.snapshotDom());
  const announcement =
    (await driver.eval<string>(`(${readAnnouncement.toString()})()`)) || undefined;
  return { focusBefore, focusAfter, domChanged: domBefore !== domAfter, announcement };
}

function interactionRecord(
  after: FocusPayload | LiveRegionPayload | KeyboardPayload,
  focusBefore: string | null,
  clock: { now(): number },
  name: string | undefined,
): EvidenceRecord {
  interactionCounter += 1;
  return {
    schemaVersion: SCHEMA_VERSION,
    interactionId: `${name ?? "interaction"}-${interactionCounter}`,
    at: clock.now(),
    observer: "interaction",
    before: { focused: focusBefore },
    after,
    changes: [],
    confidence: "high",
    source: "observed",
  };
}

/**
 * Capture a single interaction's focus behaviour: focus the trigger, activate it, and
 * record where focus lands. The result is a "focus-change" record the engine routes to
 * the focus-management concern (Tier 3).
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
    const outcome = await performInteraction(page, driver, opts.trigger);
    const after: FocusPayload = {
      kind: "focus-change",
      trigger: opts.trigger,
      focusBefore: outcome.focusBefore,
      focusAfter: outcome.focusAfter,
      announcement: outcome.announcement,
    };
    return [interactionRecord(after, outcome.focusBefore, clock, opts.name)];
  } finally {
    await browser.close();
  }
}

/**
 * Capture whether an interaction's content change was announced. Activates the trigger
 * and records the DOM change plus any live-region announcement, as a "live-region"
 * record the engine routes to the live-region concern (Tier 3).
 */
export async function captureLiveRegion(
  html: string,
  opts: { trigger: string; name?: string; intent?: Intent },
): Promise<EvidenceRecord[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const driver = new PlaywrightDriver(page);
    const clock = createClock();
    const outcome = await performInteraction(page, driver, opts.trigger);
    const after: LiveRegionPayload = {
      kind: "live-region",
      trigger: opts.trigger,
      focusBefore: outcome.focusBefore,
      focusAfter: outcome.focusAfter,
      domChanged: outcome.domChanged,
      announcement: outcome.announcement,
    };
    return [interactionRecord(after, outcome.focusBefore, clock, opts.name)];
  } finally {
    await browser.close();
  }
}

/**
 * Capture whether a control is keyboard-operable, not just mouse-operable. Activates the
 * trigger by keyboard (Enter) and by mouse on fresh DOM states, recording whether it is
 * focusable and whether each path actually changed the page. Emits a "keyboard" record
 * the engine routes to the keyboard-operable concern (Tier 3).
 */
export async function captureKeyboard(
  html: string,
  opts: { trigger: string; name?: string; intent?: Intent },
): Promise<EvidenceRecord[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    const driver = new PlaywrightDriver(page);
    const clock = createClock();

    // Keyboard path on a fresh DOM: can it be focused, and does Enter activate it?
    await page.setContent(html, { waitUntil: "load" });
    await page.focus(opts.trigger).catch(() => {});
    const focusable = await driver.eval<boolean>(
      `(() => { const el = document.querySelector(${JSON.stringify(opts.trigger)}); return !!el && document.activeElement === el; })()`,
    );
    const domBeforeKey = String(await driver.snapshotDom());
    await page.keyboard.press("Enter");
    await page.waitForTimeout(50);
    const activatesOnKey = String(await driver.snapshotDom()) !== domBeforeKey;

    // Mouse path on a fresh DOM (reset so the two are independent): does a click activate it?
    await page.setContent(html, { waitUntil: "load" });
    const domBeforeClick = String(await driver.snapshotDom());
    await page.click(opts.trigger);
    await page.waitForTimeout(50);
    const activatesOnClick = String(await driver.snapshotDom()) !== domBeforeClick;

    const after: KeyboardPayload = {
      kind: "keyboard",
      trigger: opts.trigger,
      focusable,
      activatesOnKey,
      activatesOnClick,
    };
    return [interactionRecord(after, null, clock, opts.name)];
  } finally {
    await browser.close();
  }
}

/**
 * Capture an element's rendered screenshot for a Tier 2 vision check. For focus-visible,
 * pass focus:true to focus the element first so the focus indicator is in the shot. Emits
 * a vision record carrying a base64 PNG that the engine routes to the vision concern.
 */
export async function captureVision(
  html: string,
  opts: {
    selector: string;
    kind: VisionPayload["kind"];
    context?: string;
    focus?: boolean;
    name?: string;
  },
): Promise<EvidenceRecord[]> {
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const clock = createClock();
    if (opts.focus) await page.focus(opts.selector).catch(() => {});
    const buffer = await page.locator(opts.selector).screenshot();
    interactionCounter += 1;
    const after: VisionPayload = {
      kind: opts.kind,
      selector: opts.selector,
      context: opts.context ?? "",
      screenshot: buffer.toString("base64"),
      mediaType: "image/png",
    };
    return [
      {
        schemaVersion: SCHEMA_VERSION,
        interactionId: `${opts.name ?? "vision"}-${interactionCounter}`,
        at: clock.now(),
        observer: "vision",
        before: null,
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
