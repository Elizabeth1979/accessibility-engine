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

export interface ApplyOptions {
  /** Default true: never edit files unless explicitly disabled. */
  dryRun?: boolean;
}

/**
 * Apply a FixPlan. Dry-run (default) returns the precise edit. The real source edit + PR
 * is deferred on purpose: AEE emits a targeted plan and the coding agent applies it to
 * source (JSX/templates), then runs proposePr()'s commands. Auto-editing arbitrary source
 * needs framework-aware mapping (see docs/ROADMAP.md) and is intentionally not faked.
 */
export async function applyFix(plan: FixPlan, opts: ApplyOptions = {}): Promise<string> {
  if (opts.dryRun === false) {
    throw new Error(
      "applyFix write/PR is deferred: AEE emits a targeted FixPlan; the coding agent applies it to source, then runs proposePr() commands.",
    );
  }
  return dryRun(plan);
}
