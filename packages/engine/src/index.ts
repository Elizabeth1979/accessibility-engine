import { createAIClient } from "@aee/ai";
import type {
  AIClient,
  EvidenceRecord,
  Intent,
  Judge,
  NamingPayload,
  Report,
  Verdict,
} from "@aee/core";
import {
  accessibleNameJudge,
  altTextJudge,
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
const ROUTES: Record<NamingPayload["kind"], { concern: string; judge: Judge }> = {
  image: { concern: "alt-text", judge: altTextJudge },
  "icon-button": { concern: "accessible-name", judge: accessibleNameJudge },
  link: { concern: "link-text", judge: linkTextJudge },
  heading: { concern: "heading-structure", judge: headingStructureJudge },
  "form-field": { concern: "form-label", judge: formLabelJudge },
};

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
    const kind = (record.after as Partial<NamingPayload> | null)?.kind;
    const route = kind ? ROUTES[kind] : undefined;
    if (!route) continue;
    verdicts.push(await route.judge.judge([record], ai, { concern: route.concern, intent }));
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
