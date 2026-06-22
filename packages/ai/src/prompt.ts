import type { EvidenceRecord, Intent } from "@aee/core";

/**
 * System prompt for the naming / text-alternatives concern (the Tier-1 wedge).
 * The whole point of AEE: not "is a name present?" but "is it correct in context?"
 */
export function buildSystemPrompt(concern: string): string {
  return [
    `You are an accessibility judge evaluating one concern: "${concern}".`,
    "",
    "You judge QUALITY IN CONTEXT, not mere presence. An accessible name or alt",
    "text can exist and still be wrong: generic ('image', 'button'), redundant",
    "('image of...'), or meaningless for what the element actually does.",
    "",
    "Decide a verdict:",
    "- PASS: the name/alt is meaningful, accurate, and appropriate for this element in this context.",
    "- WARN: present but mediocre — understandable yet improvable.",
    "- FAIL: missing, generic, inaccurate, or meaningless in context.",
    "- UNKNOWN: the evidence is insufficient to judge. Never guess PASS when unsure — return UNKNOWN.",
    "",
    "Ground every judgment ONLY in the evidence provided. Do not invent details about",
    "the image, page, or element that the evidence does not state.",
    "",
    "Whenever the verdict is not PASS, provide `suggestedFix`: a concrete, better",
    "accessible name or alt text, phrased for this element in this context",
    "(e.g. 'Open cart drawer', not 'button'; describe what an image conveys, not that it is an image).",
  ].join("\n");
}

/** Serializes captured evidence + declared intent into the user turn. Evidence only — no live page. */
export function buildUserPrompt(evidence: EvidenceRecord[], intent?: Intent): string {
  const parts: string[] = [];
  if (intent && (intent.purpose || intent.primaryAction || intent.notes)) {
    parts.push("Declared page intent (context for judging):");
    if (intent.purpose) parts.push(`- purpose: ${intent.purpose}`);
    if (intent.primaryAction) parts.push(`- primary action: ${intent.primaryAction}`);
    if (intent.notes) parts.push(`- notes: ${intent.notes}`);
    parts.push("");
  }
  parts.push("Evidence records (the only information you may use):");
  for (const record of evidence) {
    parts.push(
      `- observer=${record.observer} interaction=${record.interactionId} ` +
        `after=${JSON.stringify(record.after)}`,
    );
  }
  parts.push("");
  parts.push("Judge the concern for the element described by this evidence.");
  return parts.join("\n");
}
