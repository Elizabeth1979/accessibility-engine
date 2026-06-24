import { z } from "zod";

/**
 * Single source of truth for AEE's persisted contracts.
 * Types are inferred from these zod schemas; JSON Schema is generated from them
 * (see gen-schemas.ts). Bump SCHEMA_VERSION when any persisted contract changes.
 */
export const SCHEMA_VERSION = "0.1.0" as const;

export const zConfidence = z.enum(["high", "medium", "low"]);
export type Confidence = z.infer<typeof zConfidence>;

export const zReliability = z.enum(["authoritative", "advisory"]);
export type Reliability = z.infer<typeof zReliability>;

export const zStatus = z.enum(["PASS", "FAIL", "WARN", "UNKNOWN"]);
export type Status = z.infer<typeof zStatus>;

export const zSeverity = z.enum(["critical", "serious", "moderate", "minor"]);
export type Severity = z.infer<typeof zSeverity>;

export const zSource = z.enum(["observed", "derived"]);
export type Source = z.infer<typeof zSource>;

export const zChange = z.object({
  path: z.string(),
  kind: z.enum(["added", "removed", "modified"]),
  before: z.unknown().optional(),
  after: z.unknown().optional(),
});
export type Change = z.infer<typeof zChange>;

/** Plain-language purpose used to ground AI judgments (AI-first INPUT). */
export const zIntent = z.object({
  purpose: z.string().optional(),
  primaryAction: z.string().optional(),
  notes: z.string().optional(),
});
export type Intent = z.infer<typeof zIntent>;

/** Heavy artifacts (screenshots, image bytes, snapshots) are stored by reference. */
export const zArtifactRef = z.object({
  id: z.string(),
  mime: z.string().optional(),
  bytes: z.number().int().nonnegative().optional(),
});
export type ArtifactRef = z.infer<typeof zArtifactRef>;

export const zElementRef = z.object({
  selector: z.string().optional(),
  a11yId: z.string().optional(),
  role: z.string().optional(),
  name: z.string().optional(),
});
export type ElementRef = z.infer<typeof zElementRef>;

/**
 * Naming / text-alternative evidence: what a grounding observer captures for an
 * element in the accessible-name wedge, and what @aee/ai judges for *contextual
 * quality* (not mere presence). `accessibleName` is null when none is exposed
 * (e.g. an <img> with no alt). `imageDescription` stands in for vision until the
 * captured image bytes are fed to the model. The same shape is produced by real
 * capture (@aee/observers) and consumed by the AI layer (@aee/ai).
 */
export const zNamingPayload = z.object({
  kind: z.enum(["image", "icon-button", "link", "heading", "form-field"]),
  accessibleName: z.string().nullable(),
  context: z.string(),
  selector: z.string().optional(),
  imageDescription: z.string().optional(),
});
export type NamingPayload = z.infer<typeof zNamingPayload>;

/**
 * Dynamic (Tier 3) evidence: what happened to keyboard focus when a control was
 * activated, plus any live-region announcement. Judged for focus management — did
 * focus move sensibly (into a dialog, back to the trigger) or get lost.
 */
export const zFocusPayload = z.object({
  kind: z.literal("focus-change"),
  trigger: z.string(),
  focusBefore: z.string().nullable(),
  focusAfter: z.string().nullable(),
  announcement: z.string().optional(),
});
export type FocusPayload = z.infer<typeof zFocusPayload>;

/** Dynamic (Tier 3) evidence for live regions: did an interaction's content change get announced? */
export const zLiveRegionPayload = z.object({
  kind: z.literal("live-region"),
  trigger: z.string(),
  focusBefore: z.string().nullable(),
  focusAfter: z.string().nullable(),
  domChanged: z.boolean(),
  announcement: z.string().optional(),
});
export type LiveRegionPayload = z.infer<typeof zLiveRegionPayload>;

/** Dynamic (Tier 3) evidence for keyboard operability: can a control be used without a mouse? */
export const zKeyboardPayload = z.object({
  kind: z.literal("keyboard"),
  trigger: z.string(),
  focusable: z.boolean(),
  activatesOnKey: z.boolean(),
  activatesOnClick: z.boolean(),
});
export type KeyboardPayload = z.infer<typeof zKeyboardPayload>;

export const zInteractionType = z.enum([
  "tab",
  "shift-tab",
  "click",
  "hover",
  "focus",
  "enter",
  "space",
  "escape",
  "arrow",
  "type",
  "submit",
  "navigate",
  "load",
]);
export type InteractionType = z.infer<typeof zInteractionType>;

/** Immutable, timestamped observation. The only thing judges/AI may consume. */
export const zEvidenceRecord = z.object({
  schemaVersion: z.string(),
  interactionId: z.string(),
  at: z.number(),
  observer: z.string(),
  before: z.unknown(),
  after: z.unknown(),
  changes: z.array(zChange),
  confidence: zConfidence,
  source: zSource,
  raw: zArtifactRef.optional(),
});
export type EvidenceRecord = z.infer<typeof zEvidenceRecord>;

/** Produced by @aee/ai from evidence ONLY. */
export const zAIJudgment = z.object({
  schemaVersion: z.string(),
  verdict: zStatus,
  reliability: zReliability,
  confidence: zConfidence,
  reason: z.string(),
  suggestedFix: z.string().optional(),
  evidenceRefs: z.array(z.string()),
});
export type AIJudgment = z.infer<typeof zAIJudgment>;

/** A judge's combined result (deterministic floor + AI judgment). */
export const zVerdict = z.object({
  status: zStatus,
  severity: zSeverity.optional(),
  confidence: zConfidence,
  reliability: zReliability,
  reason: z.string(),
  evidenceRefs: z.array(z.string()),
  suggestedFix: z.string().optional(),
  /** Which element this verdict is about (selector; element kind via `role`; current name). */
  target: zElementRef.optional(),
});
export type Verdict = z.infer<typeof zVerdict>;

/** A structured, applicable remediation derived from a suggested fix. */
export const zFixPlan = z.object({
  target: zElementRef,
  change: zChange,
  suggestedValue: z.string(),
  rationale: z.string(),
  evidenceRefs: z.array(z.string()),
});
export type FixPlan = z.infer<typeof zFixPlan>;

export const zReleaseStatus = z.object({
  decision: z.enum(["ship", "hold", "block"]),
  fails: z.number().int().nonnegative(),
  unknowns: z.number().int().nonnegative(),
  reason: z.string(),
});
export type ReleaseStatus = z.infer<typeof zReleaseStatus>;

export const zReportSummary = z.object({
  total: z.number().int().nonnegative(),
  pass: z.number().int().nonnegative(),
  fail: z.number().int().nonnegative(),
  warn: z.number().int().nonnegative(),
  unknown: z.number().int().nonnegative(),
});
export type ReportSummary = z.infer<typeof zReportSummary>;

export const zReport = z.object({
  schemaVersion: z.string(),
  summary: zReportSummary,
  findings: z.array(zVerdict),
  release: zReleaseStatus,
});
export type Report = z.infer<typeof zReport>;
