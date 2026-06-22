import type { AIJudgment, Confidence, EvidenceRecord, Intent } from "./schemas.js";

export interface GroundedAnswer {
  answer: string;
  evidenceRefs: string[];
  confidence: Confidence;
}

/**
 * The AI layer. By contract it sees captured EvidenceRecords ONLY — never the
 * live page or a Driver. This is what keeps judgments grounded and reproducible,
 * and it is enforced structurally: @aee/ai depends only on @aee/core.
 */
export interface AIClient {
  /** Judge a concern's contextual quality, optionally grounded by declared intent. */
  judge(concern: string, evidence: EvidenceRecord[], intent?: Intent): Promise<AIJudgment>;
  /** Answer a question about findings, grounded in evidence (conversation surface). */
  explain(question: string, evidence: EvidenceRecord[]): Promise<GroundedAnswer>;
}
