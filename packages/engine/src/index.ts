import { createAIClient } from "@aee/ai";
import type {
  AIClient,
  AxePayload,
  ElementRef,
  EvidenceRecord,
  Intent,
  Judge,
  Report,
  Severity,
  Verdict,
} from "@aee/core";
import {
  accessibleNameJudge,
  altTextJudge,
  colorAloneJudge,
  focusManagementJudge,
  focusVisibleJudge,
  formLabelJudge,
  headingStructureJudge,
  keyboardOperableJudge,
  linkTextJudge,
  liveRegionJudge,
} from "@aee/judges";
import { captureAxe, captureHtml } from "@aee/playwright";
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
  "live-region": { concern: "live-region", judge: liveRegionJudge },
  keyboard: { concern: "keyboard-operable", judge: keyboardOperableJudge },
  "color-alone": { concern: "color-alone", judge: colorAloneJudge },
  "focus-visible": { concern: "focus-visible", judge: focusVisibleJudge },
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

const AXE_SEVERITY: Record<string, Severity> = {
  critical: "critical",
  serious: "serious",
  moderate: "moderate",
  minor: "minor",
};

/** Map axe-core violations to deterministic, authoritative verdicts — the floor, no AI. */
export function axeVerdicts(evidence: EvidenceRecord[]): Verdict[] {
  const verdicts: Verdict[] = [];
  for (const record of evidence) {
    const after = record.after as Partial<AxePayload> | null;
    if (!after || after.kind !== "axe") continue;
    verdicts.push({
      status: "FAIL",
      severity: AXE_SEVERITY[after.impact ?? "minor"] ?? "minor",
      confidence: "high",
      reliability: "authoritative",
      reason: `axe (${after.rule}): ${after.help ?? ""}`.trim(),
      evidenceRefs: [record.interactionId],
      target: { selector: after.selector, role: after.rule },
    });
  }
  return verdicts;
}

/**
 * Judge a captured evidence set into a report: AI quality for naming / dynamic / vision
 * records, composed with the deterministic axe floor for "axe" records.
 */
export async function judgeRun(evidence: EvidenceRecord[], ai: AIClient, intent?: Intent): Promise<Report> {
  const axe = evidence.filter((e) => (e.after as { kind?: string } | null)?.kind === "axe");
  const judged = evidence.filter((e) => (e.after as { kind?: string } | null)?.kind !== "axe");
  return buildReport([...(await judgeEvidence(judged, ai, intent)), ...axeVerdicts(axe)]);
}

/**
 * Run an end-to-end investigation: capture grounded evidence, compose the deterministic
 * axe-core floor with AI quality judgments, and assemble a report. Stored by id so the
 * agent surfaces can read its findings and evidence.
 */
export async function investigate(
  input: InvestigateInput,
  opts: InvestigateOptions = {},
): Promise<Run> {
  const ai = opts.ai ?? createAIClient();
  const namingEvidence = input.html ? await captureHtml(input.html, { intent: input.intent }) : [];
  const axeEvidence = input.html ? await captureAxe(input.html) : [];
  const evidence = [...namingEvidence, ...axeEvidence];
  const report = await judgeRun(evidence, ai, input.intent);
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
