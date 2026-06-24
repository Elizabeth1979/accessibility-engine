import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, createAIClient, fixedModel } from "@aee/ai";
import { type EvidenceRecord, SCHEMA_VERSION } from "@aee/core";
import {
  captureAxe,
  captureInteraction,
  captureKeyboard,
  captureLiveRegion,
  captureVision,
  chromiumAvailable,
} from "@aee/playwright";
import { investigate, judgeEvidence } from "./index.js";

// Deterministic: routing + per-element judging, no browser and no real model.
test("judgeEvidence routes each evidence kind to its concern and skips unroutable records", async () => {
  const ai = createAIClient({
    model: fixedModel({ verdict: "FAIL", confidence: "high", reason: "x", suggestedFix: "better" }),
  });
  const pick = (needle: string): EvidenceRecord => {
    const fixture = NAMING_FIXTURES.find((f) => f.label.includes(needle));
    assert.ok(fixture, `fixture matching "${needle}"`);
    const record = fixture.evidence[0];
    assert.ok(record);
    return record;
  };
  const evidence: EvidenceRecord[] = [
    pick("meaningless"), // image -> alt-text
    pick("vague link"), // link -> link-text
    pick("Section 2"), // heading -> heading-structure
    {
      schemaVersion: SCHEMA_VERSION,
      interactionId: "unroutable",
      at: 0,
      observer: "naming",
      before: null,
      after: null, // no kind -> skipped
      changes: [],
      confidence: "high",
      source: "observed",
    },
  ];

  const verdicts = await judgeEvidence(evidence, ai);
  assert.equal(verdicts.length, 3, "one verdict per routable element, unroutable skipped");
  assert.ok(verdicts.every((v) => v.status === "FAIL"));
  assert.ok(verdicts.every((v) => (v.suggestedFix ?? "").length > 0));
  assert.ok(verdicts.every((v) => v.target?.role), "each verdict carries its element kind");
});

// Live end-to-end: a real page, real local model. Gated on Chromium + a local server.
const BASE_URL = process.env.AEE_LLM_BASE_URL ?? "http://localhost:11434/v1";
async function localModelReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${BASE_URL}/models`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

let skip: false | string = false;
if (!chromiumAvailable()) skip = "no Chromium browser available";
else if (!(await localModelReachable())) skip = "no local model server reachable";

test("investigate: live HTML -> a multi-concern report on the local model", { skip }, async () => {
  const html = `
    <main>
      <h1>Winter coats</h1>
      <article>
        <img id="coat" alt="image"
          src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" />
        <p>Red wool knee-length winter coat. $129. <a id="more" href="/guide">Read more</a></p>
      </article>
      <header><button id="cart" aria-label="button">🛒</button></header>
      <form><label for="email">Email address</label><input id="email" type="email" /></form>
    </main>`;

  const run = await investigate(
    { html, intent: { purpose: "Clothing storefront" } },
    { ai: createAIClient({ provider: "local" }) },
  );

  // Five element types captured and judged; the bad names should fail with a fix.
  assert.ok(run.report.summary.total >= 4, `expected several findings, got ${run.report.summary.total}`);
  assert.ok(
    run.report.findings.some((v) => v.status === "FAIL" && (v.suggestedFix ?? "").length > 0),
    "at least one failing verdict with a concrete suggested fix",
  );
  assert.ok(run.report.findings.some((v) => v.target?.selector), "findings carry the element selector");
  assert.match(run.id, /^run-/);
});

test("judgeEvidence routes a focus-change record to the focus-management concern", async () => {
  const ai = createAIClient({
    model: fixedModel({
      verdict: "FAIL",
      confidence: "high",
      reason: "focus stayed on the trigger after opening a dialog",
      suggestedFix: "move focus into the dialog",
    }),
  });
  const record: EvidenceRecord = {
    schemaVersion: SCHEMA_VERSION,
    interactionId: "i1",
    at: 0,
    observer: "interaction",
    before: null,
    after: { kind: "focus-change", trigger: "#open", focusBefore: "#open", focusAfter: "#open" },
    changes: [],
    confidence: "high",
    source: "observed",
  };
  const verdicts = await judgeEvidence([record], ai);
  assert.equal(verdicts.length, 1);
  assert.equal(verdicts[0]?.status, "FAIL");
  assert.equal(verdicts[0]?.target?.selector, "#open"); // selector falls back to the trigger
});

const DIALOG_NO_FOCUS = `
  <main>
    <button id="open" onclick="document.getElementById('dlg').hidden = false">Open settings</button>
    <div id="dlg" role="dialog" aria-label="Settings" hidden>
      <p>Settings</p><button>Close</button>
    </div>
  </main>`;

test("captureInteraction: focus that does not move into the opened dialog is caught (local model)", { skip }, async () => {
  const evidence = await captureInteraction(DIALOG_NO_FOCUS, { trigger: "#open" });
  assert.equal(evidence.length, 1);
  const after = evidence[0]?.after as { kind: string; focusAfter: string | null };
  assert.equal(after.kind, "focus-change");
  assert.equal(after.focusAfter, "#open"); // the bug: focus stayed on the trigger

  const verdicts = await judgeEvidence(evidence, createAIClient({ provider: "local" }));
  assert.equal(verdicts.length, 1);
  assert.notEqual(verdicts[0]?.status, "PASS");
  assert.ok((verdicts[0]?.suggestedFix ?? "").length > 0);
});

const SILENT_UPDATE = `
  <main>
    <button id="add" onclick="document.getElementById('count').textContent='1 item'">Add to cart</button>
    <span id="count">0 items</span>
  </main>`;

const ANNOUNCED_UPDATE = `
  <main>
    <button id="add" onclick="document.getElementById('status').textContent='Added to cart'">Add to cart</button>
    <span id="status" aria-live="polite"></span>
  </main>`;

test("captureLiveRegion: a silent content update is flagged (local model)", { skip }, async () => {
  const evidence = await captureLiveRegion(SILENT_UPDATE, { trigger: "#add" });
  const after = evidence[0]?.after as { kind: string; domChanged: boolean; announcement?: string };
  assert.equal(after.kind, "live-region");
  assert.equal(after.domChanged, true); // the content changed
  assert.ok(!after.announcement); // but nothing was announced
  const verdicts = await judgeEvidence(evidence, createAIClient({ provider: "local" }));
  assert.notEqual(verdicts[0]?.status, "PASS"); // a silent change is not a PASS
});

test("captureLiveRegion: an announced content update is not flagged (local model)", { skip }, async () => {
  const evidence = await captureLiveRegion(ANNOUNCED_UPDATE, { trigger: "#add" });
  const after = evidence[0]?.after as { announcement?: string };
  assert.match(after.announcement ?? "", /added to cart/i); // the live region announced it
  const verdicts = await judgeEvidence(evidence, createAIClient({ provider: "local" }));
  assert.notEqual(verdicts[0]?.status, "FAIL"); // an announced change is not a failure
});

const MOUSE_ONLY = `<main><div id="widget" onclick="document.getElementById('out').textContent='clicked'">Toggle</div><span id="out"></span></main>`;
const KEYBOARD_OK = `<main><button id="widget" onclick="document.getElementById('out').textContent='clicked'">Toggle</button><span id="out"></span></main>`;

test("captureKeyboard: a mouse-only widget is flagged (local model)", { skip }, async () => {
  const evidence = await captureKeyboard(MOUSE_ONLY, { trigger: "#widget" });
  const after = evidence[0]?.after as {
    focusable: boolean;
    activatesOnKey: boolean;
    activatesOnClick: boolean;
  };
  assert.equal(after.activatesOnClick, true); // it does something on click
  assert.equal(after.activatesOnKey, false); // but not via the keyboard
  const verdicts = await judgeEvidence(evidence, createAIClient({ provider: "local" }));
  assert.notEqual(verdicts[0]?.status, "PASS"); // mouse-only is not a PASS
});

test("captureKeyboard: a native button is keyboard-operable (local model)", { skip }, async () => {
  const evidence = await captureKeyboard(KEYBOARD_OK, { trigger: "#widget" });
  const after = evidence[0]?.after as { activatesOnKey: boolean };
  assert.equal(after.activatesOnKey, true); // Enter activates the button
  const verdicts = await judgeEvidence(evidence, createAIClient({ provider: "local" }));
  assert.notEqual(verdicts[0]?.status, "FAIL"); // keyboard-operable is not a failure
});

const COLOR_ONLY = `<main><span id="status" style="color:#d00">Payment failed</span></main>`;

test("captureVision captures an element screenshot as base64", {
  skip: chromiumAvailable() ? false : "no Chromium browser available",
}, async () => {
  const evidence = await captureVision(COLOR_ONLY, {
    selector: "#status",
    kind: "color-alone",
    context: "the only error cue is the red text colour",
  });
  assert.equal(evidence.length, 1);
  const after = evidence[0]?.after as { kind: string; screenshot: string };
  assert.equal(after.kind, "color-alone");
  assert.ok(after.screenshot.length > 100); // a real base64 PNG
});

// Vision judging runs on a vision-capable local model. gemma4:e4b is multimodal, so the
// default local provider works (set AEE_VISION_MODEL to override). Gated on Chromium + a
// reachable local server, like the other live tests.
const visionModel = process.env.AEE_VISION_MODEL;
const visionSkip: false | string = !chromiumAvailable()
  ? "no Chromium browser available"
  : (await localModelReachable())
    ? false
    : "no local model server reachable";

test("captureVision: color-only information is caught by a vision model", { skip: visionSkip }, async () => {
  const evidence = await captureVision(COLOR_ONLY, {
    selector: "#status",
    kind: "color-alone",
    context: "the only error cue is the red text colour",
  });
  const ai = createAIClient({ provider: "local", local: { model: visionModel } });
  const verdicts = await judgeEvidence(evidence, ai);
  assert.notEqual(verdicts[0]?.status, "PASS"); // colour-only is not a PASS
});

const NO_FOCUS_RING = `<main><button id="go" style="outline:none;border:none;background:#eee;padding:8px">Go</button></main>`;

test("captureVision: a removed focus indicator is caught by a vision model", { skip: visionSkip }, async () => {
  const evidence = await captureVision(NO_FOCUS_RING, {
    selector: "#go",
    kind: "focus-visible",
    focus: true,
    context: "the button is keyboard-focused; its outline was removed",
  });
  const ai = createAIClient({ provider: "local", local: { model: visionModel } });
  const verdicts = await judgeEvidence(evidence, ai);
  assert.notEqual(verdicts[0]?.status, "PASS"); // no visible focus indicator is not a PASS
});

const AXE_BAD = `<main><button id="bare"></button><img src="x.png"></main>`;

test("captureAxe produces deterministic violation evidence", {
  skip: chromiumAvailable() ? false : "no Chromium browser available",
}, async () => {
  const evidence = await captureAxe(AXE_BAD);
  const rules = evidence.map((e) => (e.after as { rule: string }).rule);
  assert.ok(rules.includes("button-name"), `expected button-name in ${rules.join(",")}`);
  assert.ok(rules.includes("image-alt"));
  assert.ok(evidence.every((e) => (e.after as { kind: string }).kind === "axe"));
});

const FLOOR_AND_AI = `<main>
  <h1>Shop</h1>
  <img id="coat" alt="image" src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7">
  <button id="bare"></button>
</main>`;

test("investigate composes the axe floor with AI quality (local model)", { skip }, async () => {
  const run = await investigate({ html: FLOOR_AND_AI }, { ai: createAIClient({ provider: "local" }) });
  const findings = run.report.findings;
  // Deterministic floor: axe flags the empty button — authoritative, no AI.
  assert.ok(
    findings.some(
      (v) => v.target?.role === "button-name" && v.status === "FAIL" && v.reliability === "authoritative",
    ),
    "axe floor should flag the empty button",
  );
  // AI quality: alt='image' is present (axe passes it) but flagged as meaningless.
  assert.ok(
    findings.some((v) => v.target?.selector === "#coat" && v.status === "FAIL"),
    "AI should flag the meaningless alt that axe lets pass",
  );
});
