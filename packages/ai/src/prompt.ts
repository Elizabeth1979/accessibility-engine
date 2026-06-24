import type { EvidenceRecord, Intent } from "@aee/core";

/**
 * System prompt for the naming / text-alternatives concern (the Tier-1 wedge).
 * The whole point of AEE: not "is a name present?" but "is it correct in context?"
 */
/** Concern-specific accessibility principles the generic rubric can't capture. */
const CONCERN_GUIDANCE: Record<string, string> = {
  "alt-text":
    "For alt text specifically: it must convey what the image communicates in this context, not merely that it is an image. 'image', 'photo', or a filename is a FAIL; a genuinely decorative image should have empty alt text.",
  "accessible-name":
    "For accessible names specifically: the name must describe what the control does in this context — e.g. 'Open cart drawer', not 'button'.",
  "link-text":
    "For link text specifically: it must make sense on its own. Screen-reader users navigate a list of links out of context, so generic text like 'Read more', 'Click here', or 'Learn more' is a FAIL even when the surrounding paragraph explains it — the link itself must convey where it goes.",
  "heading-structure":
    "For headings specifically: a heading must describe the content of the section it labels. Generic or positional headings like 'Section 2', 'Heading', or 'Details' are a FAIL — users navigate by a list of headings out of context.",
  "form-label":
    "For form fields specifically: every input needs a programmatically associated label. A placeholder is NOT a label (it disappears on input and is unreliable for assistive tech), so a field labeled only by a placeholder — or with no label at all — is a FAIL.",
  "focus-management":
    "For focus management specifically: after a control opens a dialog, menu, or new view, keyboard focus must move INTO the new content; after it closes, focus must return to the trigger. Focus that stays on the trigger, is lost to the page body, or jumps to the top is a FAIL. Judge from focusBefore → focusAfter given what the interaction did.",
  "live-region":
    "For live regions specifically: when an interaction changes page content the user did not navigate to (domChanged is true) — a status, error, count, or result — that change must be announced via a live region (aria-live / role=status / role=alert). If domChanged is true and `announcement` is empty, screen-reader users miss the update: FAIL. If it was announced, judge whether the announcement is meaningful. If the change was instead handled by moving keyboard focus into new content (focusBefore differs from focusAfter), a live region is not required: PASS.",
  "keyboard-operable":
    "For keyboard operability specifically: any control that works with a mouse must also work with the keyboard. If activatesOnClick is true (the control does something on click) but it is not focusable, or pressing Enter does nothing (activatesOnKey is false), the control is mouse-only — keyboard and screen-reader users cannot operate it: FAIL. A native button, or a div with role=button + tabindex + a key handler, is PASS.",
  "color-alone":
    "For color-alone specifically: judge the SCREENSHOT. Information must not be conveyed by color alone. If a state (error, success, required, selected, a link) is distinguished ONLY by color — no text label, icon, underline, or shape — then users who can't perceive that color miss it: FAIL. If there is a non-color cue as well, PASS.",
  "focus-visible":
    "For focus visibility specifically: judge the SCREENSHOT of the focused element. A keyboard-focused element must have a clearly visible focus indicator (outline, ring, or other obvious styling). If there is no visible indicator — e.g. the outline was removed — keyboard users can't tell where they are: FAIL. A clear, sufficiently contrasting indicator is PASS.",
  "text-in-images":
    "For text-in-images specifically: judge the SCREENSHOT. Meaningful text baked into an image (a banner, button, or promo whose words are pixels, not real text) can't be resized, recoloured, translated, or read by a screen reader: FAIL, and the fix is real HTML text. A logo or wordmark is acceptable. No baked-in text is PASS.",
};

export function buildSystemPrompt(concern: string): string {
  const lines = [
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
  ];
  const guidance = CONCERN_GUIDANCE[concern];
  if (guidance) lines.push("", guidance);
  return lines.join("\n");
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

/** System prompt for grounded Q&A over evidence — the conversation surface. */
export function buildExplainSystemPrompt(): string {
  return [
    "You are an accessibility expert answering a question about captured evidence.",
    "Answer ONLY from the evidence provided. Do not invent details about the page,",
    "element, or image that the evidence does not state. If the evidence is insufficient",
    "to answer, say so plainly rather than guessing.",
    "Be concise and concrete; when relevant, name the element and quote its accessible name.",
  ].join("\n");
}

/** Serializes a question + evidence for the conversation surface. Evidence only — no live page. */
export function buildExplainUserPrompt(question: string, evidence: EvidenceRecord[]): string {
  const parts: string[] = [`Question: ${question}`, ""];
  if (evidence.length === 0) {
    parts.push("Evidence: (none captured)");
  } else {
    parts.push("Evidence records (the only information you may use):");
    for (const record of evidence) {
      parts.push(
        `- observer=${record.observer} interaction=${record.interactionId} ` +
          `after=${JSON.stringify(record.after)}`,
      );
    }
  }
  return parts.join("\n");
}
