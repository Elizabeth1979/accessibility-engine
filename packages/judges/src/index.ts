import type {
  AIClient,
  AIJudgment,
  EvidenceRecord,
  Judge,
  JudgeContext,
  Tier,
  Verdict,
} from "@aee/core";

function toVerdict(j: AIJudgment): Verdict {
  return {
    status: j.verdict,
    confidence: j.confidence,
    reliability: j.reliability,
    reason: j.reason,
    evidenceRefs: j.evidenceRefs,
    suggestedFix: j.suggestedFix,
  };
}

/**
 * Stub judge: a deterministic floor (axe-core, wired in a later phase) plus an
 * AI judgment. Until the AI layer is wired, it returns the AI client's UNKNOWN,
 * never upgrading to PASS.
 */
function stubJudge(name: string, tier: Tier): Judge {
  return {
    name,
    tier,
    // Phase: `floor` delegates Tier-4 / presence checks to axe-core.
    async judge(evidence: EvidenceRecord[], ai: AIClient, ctx: JudgeContext): Promise<Verdict> {
      const judgment = await ai.judge(ctx.concern || name, evidence, ctx.intent);
      return toVerdict(judgment);
    },
  };
}

// Tier 1 — AI transforms binary checks into quality + fix (the wedge).
export const altTextJudge = stubJudge("alt-text", 1); // Phase 1: the walking skeleton
export const accessibleNameJudge = stubJudge("accessible-name", 1);
export const linkTextJudge = stubJudge("link-text", 1);
export const formLabelJudge = stubJudge("form-label", 1);
export const headingStructureJudge = stubJudge("heading-structure", 1);

// Tier 2 — AI sees what static rules are blind to.
export const colorAloneJudge = stubJudge("color-alone", 2);
export const focusVisibleJudge = stubJudge("focus-visible", 2);
export const textInImagesJudge = stubJudge("text-in-images", 2);

// Tier 3 — AI + runtime evidence (dynamic).
export const focusManagementJudge = stubJudge("focus-management", 3);
export const liveRegionJudge = stubJudge("live-region", 3);
export const keyboardOperableJudge = stubJudge("keyboard-operable", 3);
export const networkErrorJudge = stubJudge("network-error", 3);

// Tier 4 — deterministic floor (axe-core); AI adds nothing here.
export const contrastJudge = stubJudge("contrast", 4);
export const ariaValidityJudge = stubJudge("aria-validity", 4);

// Tier 5 — advisory only; never a confident PASS.
export const captionAccuracyJudge = stubJudge("caption-accuracy", 5);

export const allJudges: Judge[] = [
  altTextJudge,
  accessibleNameJudge,
  linkTextJudge,
  formLabelJudge,
  headingStructureJudge,
  colorAloneJudge,
  focusVisibleJudge,
  textInImagesJudge,
  focusManagementJudge,
  liveRegionJudge,
  keyboardOperableJudge,
  networkErrorJudge,
  contrastJudge,
  ariaValidityJudge,
  captionAccuracyJudge,
];
