import assert from "node:assert/strict";
import { test } from "node:test";
import type { Verdict } from "@aee/core";
import {
  applyFix,
  applyFixToJsx,
  applyFixToSource,
  applyFixes,
  dryRun,
  planFix,
  planFixes,
  proposePr,
} from "./index.js";

const fail = (extra: Partial<Verdict>): Verdict => ({
  status: "FAIL",
  confidence: "high",
  reliability: "authoritative",
  reason: "x",
  evidenceRefs: ["i1"],
  ...extra,
});

test("planFix builds a plan from a suggested fix and dry-runs it", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "Icon button has no meaningful name",
    evidenceRefs: ["i1"],
    suggestedFix: "Open cart drawer",
  };
  const plan = planFix(finding);
  assert.ok(plan);
  assert.equal(plan?.suggestedValue, "Open cart drawer");
  assert.match(dryRun(plan!), /Open cart drawer/);
});

test("planFix returns null when there is no suggested fix", () => {
  const finding: Verdict = {
    status: "UNKNOWN",
    confidence: "low",
    reliability: "advisory",
    reason: "no evidence",
    evidenceRefs: [],
  };
  assert.equal(planFix(finding), null);
});

test("planFix targets the element and picks the attribute by kind", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "Icon button named 'button'",
    evidenceRefs: ["i1"],
    suggestedFix: "Open cart drawer",
    target: { selector: "#cart", role: "icon-button", name: "button" },
  };
  const plan = planFix(finding);
  assert.ok(plan);
  assert.equal(plan?.change.path, "aria-label"); // icon-button -> aria-label
  assert.equal(plan?.target.selector, "#cart");
  assert.equal(plan?.change.before, "button");
  assert.match(dryRun(plan!), /#cart/);
  assert.match(dryRun(plan!), /aria-label/);
});

test("proposePr builds a gh PR scaffold from fix plans (dry-run, not executed)", () => {
  const finding: Verdict = {
    status: "FAIL",
    confidence: "high",
    reliability: "authoritative",
    reason: "alt 'image' is generic",
    evidenceRefs: ["i1"],
    suggestedFix: "Red wool winter coat",
    target: { selector: "#coat", role: "image", name: "image" },
  };
  const pr = proposePr(planFixes([finding]));
  assert.match(pr.title, /1 accessibility fix\b/);
  assert.ok(pr.commands.some((c) => c.startsWith("gh pr create")));
  assert.match(pr.body, /Red wool winter coat/);
  assert.match(pr.body, /alt/); // the attribute being set
});

test("applyFix patches an attribute on an id-located element", () => {
  const plan = planFix(
    fail({ suggestedFix: "Red wool winter coat", target: { selector: "#coat", role: "image", name: "image" } }),
  );
  assert.ok(plan);
  const result = applyFix(plan, `<main><img id="coat" alt="image" src="x.png"></main>`);
  assert.equal(result.applied, true);
  assert.match(result.source, /alt="Red wool winter coat"/);
  assert.ok(!result.source.includes('alt="image"'));
});

test("applyFix inserts a missing attribute (icon button -> aria-label)", () => {
  const plan = planFix(
    fail({ suggestedFix: "Open cart drawer", target: { selector: "#cart", role: "icon-button", name: "button" } }),
  );
  const result = applyFix(plan!, `<button id="cart">🛒</button>`);
  assert.equal(result.applied, true);
  assert.match(result.source, /aria-label="Open cart drawer"/);
});

test("applyFix declines text-content and non-id targets (with a manual instruction)", () => {
  const link = planFix(
    fail({ suggestedFix: "Read the care guide", target: { selector: "#more", role: "link", name: "Read more" } }),
  );
  const r1 = applyFix(link!, `<a id="more" href="/g">Read more</a>`);
  assert.equal(r1.applied, false); // textContent is not an auto-settable attribute
  assert.match(r1.detail, /manually/);

  const noId = planFix(fail({ suggestedFix: "Logo", target: { selector: "img.logo", role: "image" } }));
  assert.equal(applyFix(noId!, `<img class="logo" alt="image">`).applied, false);
});

test("applyFixes applies multiple plans to one source", () => {
  const plans = planFixes([
    fail({ suggestedFix: "Red coat", target: { selector: "#coat", role: "image", name: "image" } }),
    fail({ suggestedFix: "Open cart", target: { selector: "#cart", role: "icon-button", name: "button" } }),
  ]);
  const { source, results } = applyFixes(plans, `<img id="coat" alt="image"><button id="cart"></button>`);
  assert.equal(results.filter((r) => r.applied).length, 2);
  assert.match(source, /alt="Red coat"/);
  assert.match(source, /aria-label="Open cart"/);
});

// Framework-aware apply_fix (Future item 2): patch JSX/TSX source via a real parse, never a blind regex.
const ICON_BUTTON_PLAN = () =>
  planFix(fail({ suggestedFix: "Open cart drawer", target: { selector: "#cart", role: "icon-button", name: "button" } }))!;

test("applyFixToJsx patches a string attribute on a JSX component (by id, via AST)", () => {
  const src = `export const Cart = () => <IconButton id="cart" aria-label="button" onClick={open} />;`;
  const r = applyFixToJsx(ICON_BUTTON_PLAN(), src);
  assert.equal(r.applied, true);
  assert.match(r.source, /aria-label="Open cart drawer"/);
  assert.ok(!r.source.includes('aria-label="button"'));
  assert.ok(r.source.includes("onClick={open}")); // surrounding JSX untouched
});

test("applyFixToJsx declines a dynamic JSX expression value (never corrupts source)", () => {
  const src = `<IconButton id="cart" aria-label={label} />`;
  const r = applyFixToJsx(ICON_BUTTON_PLAN(), src);
  assert.equal(r.applied, false);
  assert.match(r.detail, /dynamic JSX expression/);
  assert.equal(r.source, src); // unchanged — no duplicate attribute, no corruption
});

test("applyFixToJsx inserts a missing attribute on a JSX element", () => {
  const plan = planFix(
    fail({ suggestedFix: "Save changes", target: { selector: "#save", role: "icon-button", name: "button" } }),
  )!;
  const r = applyFixToJsx(plan, `<button id="save" onClick={save}>Save</button>`);
  assert.equal(r.applied, true);
  assert.match(r.source, /aria-label="Save changes"/);
});

test("applyFixToJsx matches by the current value when there is no id, and declines ambiguity", () => {
  const noId = planFix(
    fail({ suggestedFix: "Open cart drawer", target: { selector: "button.icon", role: "icon-button", name: "button" } }),
  )!;
  const r1 = applyFixToJsx(noId, `<button className="icon" aria-label="button">🛒</button>`);
  assert.equal(r1.applied, true);
  assert.match(r1.source, /aria-label="Open cart drawer"/);

  const ambiguous = planFix(fail({ suggestedFix: "Open cart drawer", target: { role: "icon-button", name: "button" } }))!;
  const r2 = applyFixToJsx(ambiguous, `<><button aria-label="button" /><button aria-label="button" /></>`);
  assert.equal(r2.applied, false);
  assert.match(r2.detail, /[Aa]mbiguous/);
});

test("applyFixToSource routes JSX through the AST patcher and HTML through the regex patcher", () => {
  assert.match(applyFixToSource(ICON_BUTTON_PLAN(), `<IconButton id="cart" aria-label="button" />`).source, /aria-label="Open cart drawer"/);
  assert.match(applyFixToSource(ICON_BUTTON_PLAN(), `<button id="cart" aria-label="button"></button>`).source, /aria-label="Open cart drawer"/);
});
