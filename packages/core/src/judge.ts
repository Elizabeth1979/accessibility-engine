import type { AIClient } from "./ai.js";
import type { EvidenceRecord, Intent, Verdict } from "./schemas.js";

/** Coverage tier (see docs/coverage-map.md). */
export type Tier = 1 | 2 | 3 | 4 | 5;

export interface JudgeContext {
  concern: string;
  intent?: Intent;
}

/**
 * One accessibility concern, evaluated as an optional deterministic floor
 * (often axe-core backed) plus an AI judgment. A judge never reads the live
 * page and never upgrades UNKNOWN (or an advisory result) to PASS.
 */
export interface Judge {
  readonly name: string;
  readonly tier: Tier;
  /** Optional presence/math check; the binary floor beneath the AI judgment. */
  floor?(evidence: EvidenceRecord[]): Verdict;
  /** Contextual quality judgment, grounded in evidence. */
  judge(evidence: EvidenceRecord[], ai: AIClient, ctx: JudgeContext): Promise<Verdict>;
}
