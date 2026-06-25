import { parse } from "@babel/parser";
import * as t from "@babel/types";
import type { ElementRef, FixPlan, Verdict } from "@aee/core";

/** The source attribute/property a fix for each element kind should set. */
const ATTRIBUTE_BY_KIND: Record<string, string> = {
  image: "alt",
  "icon-button": "aria-label",
  link: "textContent",
  heading: "textContent",
  "form-field": "label",
};

/** The attribute/property to set for an element kind (carried on Verdict.target.role). */
export function attributeForKind(kind?: string): string {
  return (kind && ATTRIBUTE_BY_KIND[kind]) || "accessibleName";
}

/**
 * Turn a finding into a structured, applicable plan, targeted at its element. The plan
 * names the element (selector), the attribute to set, and the before/after values —
 * everything a coding agent needs to apply the fix to source.
 */
export function planFix(finding: Verdict): FixPlan | null {
  if (!finding.suggestedFix) return null;
  const target: ElementRef = finding.target ?? {};
  return {
    target,
    change: {
      path: attributeForKind(target.role),
      kind: "modified",
      before: target.name,
      after: finding.suggestedFix,
    },
    suggestedValue: finding.suggestedFix,
    rationale: finding.reason,
    evidenceRefs: finding.evidenceRefs,
  };
}

/** Plans for every finding that carries a concrete suggested value. */
export function planFixes(findings: Verdict[]): FixPlan[] {
  return findings.map((finding) => planFix(finding)).filter((plan): plan is FixPlan => plan !== null);
}

/** Human/agent-readable preview of a fix without touching the working tree. */
export function dryRun(plan: FixPlan): string {
  const where = plan.target.selector ? ` on \`${plan.target.selector}\`` : "";
  const before = plan.change.before ? ` (was ${JSON.stringify(plan.change.before)})` : "";
  return `Set \`${plan.change.path}\`${where} to ${JSON.stringify(plan.suggestedValue)}${before}`;
}

export interface PullRequestPlan {
  branch: string;
  title: string;
  body: string;
  /** git/gh commands to run after the edits are applied. Returned, never executed here. */
  commands: string[];
}

/**
 * Build a pull-request scaffold from fix plans. Dry-run by construction: it returns the
 * git/gh commands rather than running them, because AEE emits the targeted fixes and the
 * coding agent (which can edit source and has `gh`) applies and ships them.
 */
export function proposePr(plans: FixPlan[], opts: { branch?: string } = {}): PullRequestPlan {
  const branch = opts.branch ?? "aee/accessibility-fixes";
  const title = `a11y: ${plans.length} accessibility fix${plans.length === 1 ? "" : "es"}`;
  const body = [
    "AEE proposes the following accessibility fixes, grounded in captured evidence:",
    "",
    ...plans.map((plan) => `- ${dryRun(plan)} — ${plan.rationale}`),
  ].join("\n");
  const commands = [
    `git checkout -b ${branch}`,
    "# apply the edits listed in the PR body to source",
    `git commit -am ${JSON.stringify(title)}`,
    `gh pr create --title ${JSON.stringify(title)} --body ${JSON.stringify(body)}`,
  ];
  return { branch, title, body, commands };
}

export interface ApplyResult {
  /** Whether the edit was applied to the source. */
  applied: boolean;
  /** The patched source (unchanged if not applied). */
  source: string;
  /** What happened, or why it couldn't be auto-applied (with a manual instruction). */
  detail: string;
}

/** Attributes applyFix can set directly. Text content and labels are left to manual edits. */
const SETTABLE_ATTRS = new Set(["alt", "aria-label", "title"]);

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
function escapeAttr(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;");
}

/**
 * Apply a FixPlan to source HTML. Handles the tractable case the roadmap scopes: setting
 * an attribute (alt / aria-label / title) on an element located by `#id`. Non-id selectors
 * and text/label content return applied:false with a manual instruction — framework-aware
 * source mapping is out of scope. Pure: returns the patched source, writes nothing.
 */
export function applyFix(plan: FixPlan, source: string): ApplyResult {
  const selector = plan.target.selector;
  const attribute = plan.change.path;
  const value = plan.suggestedValue;
  if (!selector || !selector.startsWith("#")) {
    return { applied: false, source, detail: `Cannot auto-locate ${selector ?? "the element"} (only #id selectors) — apply manually: ${dryRun(plan)}` };
  }
  if (!SETTABLE_ATTRS.has(attribute)) {
    return { applied: false, source, detail: `Cannot auto-edit \`${attribute}\` (text/label content) — apply manually: ${dryRun(plan)}` };
  }
  const idRe = new RegExp(`\\bid=["']${escapeRegExp(selector.slice(1))}["']`);
  const tagRe = /<([a-zA-Z][\w-]*)((?:[^>"']|"[^"]*"|'[^']*')*)>/g;
  for (let m = tagRe.exec(source); m !== null; m = tagRe.exec(source)) {
    const full = m[0];
    const tagName = m[1] ?? "";
    const rawAttrs = m[2] ?? "";
    if (!idRe.test(rawAttrs)) continue;
    const selfClosing = /\/\s*$/.test(rawAttrs);
    const attrs = (selfClosing ? rawAttrs.replace(/\/\s*$/, "") : rawAttrs).replace(/\s+$/, "");
    const attrRe = new RegExp(`\\s${escapeRegExp(attribute)}=["'][^"']*["']`);
    const set = ` ${attribute}="${escapeAttr(value)}"`;
    const newAttrs = attrRe.test(attrs) ? attrs.replace(attrRe, set) : `${attrs}${set}`;
    const newTag = `<${tagName}${newAttrs}${selfClosing ? " />" : ">"}`;
    const patched = source.slice(0, m.index) + newTag + source.slice(m.index + full.length);
    return { applied: true, source: patched, detail: `Set \`${attribute}\` on ${selector} to ${JSON.stringify(value)}` };
  }
  return { applied: false, source, detail: `Element ${selector} not found in source — apply manually: ${dryRun(plan)}` };
}

/** Parse JSX/TSX and collect its opening elements, or null if the source isn't valid JS/TS/JSX (e.g. HTML). */
function jsxOpeningElements(source: string): t.JSXOpeningElement[] | null {
  let program: t.Program;
  try {
    program = parse(source, { sourceType: "module", plugins: ["jsx", "typescript"] }).program;
  } catch {
    return null; // not parseable as JS/TS/JSX — the caller falls back to the HTML regex path
  }
  const out: t.JSXOpeningElement[] = [];
  t.traverseFast(program, (node) => {
    if (t.isJSXOpeningElement(node)) out.push(node);
  });
  return out;
}

/** The JSXAttribute named `name` on an opening element, if present. */
function jsxAttr(el: t.JSXOpeningElement, name: string): t.JSXAttribute | undefined {
  for (const a of el.attributes) {
    if (t.isJSXAttribute(a) && t.isJSXIdentifier(a.name) && a.name.name === name) return a;
  }
  return undefined;
}

/** The string value of attribute `name`, only when it is a plain string literal (not an expression). */
function jsxStringValue(el: t.JSXOpeningElement, name: string): string | undefined {
  const attr = jsxAttr(el, name);
  return attr && t.isStringLiteral(attr.value) ? attr.value.value : undefined;
}

/**
 * Apply a FixPlan to JSX/TSX source via a real parse — never a blind regex — so it can locate the
 * element robustly and refuse anything it can't patch safely. Sets a string attribute
 * (alt / aria-label / title) on the element identified by the plan's #id, or, with no id, by the
 * attribute's current `before` value. It declines (never corrupts) when the attribute is a dynamic
 * JSX expression `{...}`, when the match is ambiguous, or when the value isn't a string attribute.
 * Pure: returns the patched source, writes nothing.
 */
export function applyFixToJsx(plan: FixPlan, source: string): ApplyResult {
  const attribute = plan.change.path;
  const value = plan.suggestedValue;
  const where = plan.target.selector ? ` on ${plan.target.selector}` : "";
  if (!SETTABLE_ATTRS.has(attribute)) {
    return { applied: false, source, detail: `Cannot auto-edit \`${attribute}\` (text/label content) — apply manually: ${dryRun(plan)}` };
  }
  const elements = jsxOpeningElements(source);
  if (!elements) return { applied: false, source, detail: `Could not parse JSX source — apply manually: ${dryRun(plan)}` };

  const id = plan.target.selector?.startsWith("#") ? plan.target.selector.slice(1) : undefined;
  const before = typeof plan.change.before === "string" ? plan.change.before : undefined;
  const matches = elements.filter((el) =>
    id !== undefined
      ? jsxStringValue(el, "id") === id
      : before !== undefined
        ? jsxStringValue(el, attribute) === before
        : false,
  );
  if (matches.length === 0) {
    return { applied: false, source, detail: `Element${where} not found in JSX — apply manually: ${dryRun(plan)}` };
  }
  if (matches.length > 1) {
    return { applied: false, source, detail: `Ambiguous match${where} in JSX — apply manually: ${dryRun(plan)}` };
  }

  const el = matches[0] as t.JSXOpeningElement;
  const attr = jsxAttr(el, attribute);
  const set = `Set \`${attribute}\`${where} to ${JSON.stringify(value)}`;
  if (attr) {
    if (!t.isStringLiteral(attr.value) || attr.value.start == null || attr.value.end == null) {
      return { applied: false, source, detail: `\`${attribute}\`${where} is a dynamic JSX expression — apply manually: ${dryRun(plan)}` };
    }
    const patched = source.slice(0, attr.value.start) + `"${escapeAttr(value)}"` + source.slice(attr.value.end);
    return { applied: true, source: patched, detail: set };
  }
  if (el.name.end == null) {
    return { applied: false, source, detail: `Could not locate ${plan.target.selector ?? "the element"} precisely — apply manually: ${dryRun(plan)}` };
  }
  const patched = source.slice(0, el.name.end) + ` ${attribute}="${escapeAttr(value)}"` + source.slice(el.name.end);
  return { applied: true, source: patched, detail: set };
}

/** Apply a fix to source, auto-detecting JSX/TSX (AST) vs HTML (regex). */
export function applyFixToSource(plan: FixPlan, source: string): ApplyResult {
  const jsx = jsxOpeningElements(source);
  return jsx && jsx.length > 0 ? applyFixToJsx(plan, source) : applyFix(plan, source);
}

/** Apply several plans to one source, in order. Returns the final source + per-plan results. */
export function applyFixes(plans: FixPlan[], source: string): { source: string; results: ApplyResult[] } {
  const results: ApplyResult[] = [];
  let current = source;
  for (const plan of plans) {
    const result = applyFixToSource(plan, current);
    results.push(result);
    current = result.source;
  }
  return { source: current, results };
}
