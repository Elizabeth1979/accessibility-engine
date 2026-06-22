import type { FixPlan, Verdict } from "@aee/core";

/** Turn a finding's suggested fix into a structured, applicable plan. Stub. */
export function planFix(finding: Verdict): FixPlan | null {
  if (!finding.suggestedFix) return null;
  return {
    target: {},
    change: { path: "", kind: "modified" },
    suggestedValue: finding.suggestedFix,
    rationale: finding.reason,
    evidenceRefs: finding.evidenceRefs,
  };
}

/** Human-readable preview of a fix without touching the working tree. */
export function dryRun(plan: FixPlan): string {
  return `FixPlan → set "${plan.suggestedValue}" (${plan.rationale})`;
}

export interface ApplyOptions {
  /** Default true: never edit files unless explicitly disabled. */
  dryRun?: boolean;
  /** When applying for real, open a PR via the `gh` CLI. */
  openPr?: boolean;
}

/**
 * Apply a FixPlan as a safe source edit and optionally open a PR.
 * Phase 4 implements the edit + `gh pr create`. Until then this is dry-run only.
 */
export async function applyFix(plan: FixPlan, opts: ApplyOptions = {}): Promise<string> {
  if (opts.dryRun !== false) {
    return dryRun(plan);
  }
  throw new Error("applyFix (write + PR) not implemented (scaffold stub).");
}
