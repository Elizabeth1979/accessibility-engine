import { createAIClient } from "@aee/ai";
import type {
  AIClient,
  ElementRef,
  EvidenceRecord,
  Intent,
  Judge,
  Report,
  Verdict,
} from "@aee/core";
import {
  accessibleNameJudge,
  altTextJudge,
  focusManagementJudge,
  formLabelJudge,
  headingStructureJudge,
  linkTextJudge,
} from "@aee/judges";
import { captureHtml } from "@aee/playwright";
import { buildReport } from "@aee/reporter";

/**
 * Routes each captured element kind to the judge + concern that grades it. This is
 * the composition the dependency graph forbids elsewhere: only @aee/engine may reach
 * both a driver (via @aee/playwright) and the judges. @aee/ai still sees evidence only.
 */
const ROUTES: Record<string, { concern: string; judge: Judge }> = {
  image: { concern: "alt-text", judge: altTextJudge },
  "icon-button": { concern: "accessible-name", judge: accessibleNameJudge },
  link: { concern: "link-text", judge: linkTextJudge },
  heading: { concern: "heading-structure", judge: headingStructureJudge },
  "form-field": { concern: "form-label", judge: formLabelJudge },
  "focus-change": { concern: "focus-management", judge: focusManagementJudge },
};

/** Best-effort element identity from a payload (naming uses `selector`, dynamic uses `trigger`). */
function elementTarget(payload: Record<string, unknown>, kind: string): ElementRef {
  const selector =
    typeof payload.selector === "string"
      ? payload.selector
      : typeof payload.trigger === "string"
        ? payload.trigger
        : undefined;
  const name = typeof payload.accessibleName === "string" ? payload.accessibleName : undefined;
  return { selector, role: kind, name };
}

/**
 * Judge captured evidence per element: each record is routed by its kind to the
 * matching concern and judged on its own, yielding one verdict per element.
 * Records whose kind has no route are skipped (no spurious verdicts).
 */
export async function judgeEvidence(
  evidence: EvidenceRecord[],
  ai: AIClient,
  intent?: Intent,
): Promise<Verdict[]> {
  const verdicts: Verdict[] = [];
  for (const record of evidence) {
    const payload =
      record.after && typeof record.after === "object"
        ? (record.after as Record<string, unknown>)
        : undefined;
    const kind = payload && typeof payload.kind === "string" ? payload.kind : undefined;
    const route = kind ? ROUTES[kind] : undefined;
    if (!route || !payload || !kind) continue;
    const verdict = await route.judge.judge([record], ai, { concern: route.concern, intent });
    // Attach the element this verdict is about, so the report and FixPlans can target it.
    verdicts.push({ ...verdict, target: elementTarget(payload, kind) });
  }
  return verdicts;
}

export interface InvestigateInput {
  /** HTML to render and investigate. (URL navigation is a later phase.) */
  html?: string;
  /** Declared page intent, fed to the AI to ground judgments. */
  intent?: Intent;
}

export interface InvestigateOptions {
  /** AI client to judge with. Defaults to createAIClient() (honours AEE_LLM_PROVIDER). */
  ai?: AIClient;
}

/** A completed investigation: its report plus the evidence it was derived from. */
export interface Run {
  id: string;
  report: Report;
  evidence: EvidenceRecord[];
}

const runs = new Map<string, Run>();
let runCounter = 0;
let lastRunId: string | undefined;

/**
 * Run an end-to-end investigation: capture grounded evidence, judge each element in
 * context, and assemble a report. The result is stored so the agent surfaces can
 * read its findings and evidence by id.
 */
export async function investigate(
  input: InvestigateInput,
  opts: InvestigateOptions = {},
): Promise<Run> {
  const ai = opts.ai ?? createAIClient();
  const evidence = input.html ? await captureHtml(input.html, { intent: input.intent }) : [];
  const verdicts = await judgeEvidence(evidence, ai, input.intent);
  const report = buildReport(verdicts);
  runCounter += 1;
  const run: Run = { id: `run-${runCounter}`, report, evidence };
  runs.set(run.id, run);
  lastRunId = run.id;
  return run;
}

/** Look up a stored run by id. */
export function getRun(id: string): Run | undefined {
  return runs.get(id);
}

/** The most recent run, if any — convenience for single-investigation flows. */
export function latestRun(): Run | undefined {
  return lastRunId ? runs.get(lastRunId) : undefined;
}
