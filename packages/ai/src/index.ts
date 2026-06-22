import { SCHEMA_VERSION } from "@aee/core";
import type { AIClient, AIJudgment, EvidenceRecord, GroundedAnswer, Intent } from "@aee/core";

/**
 * Stub AI client.
 *
 * Phase: wire the latest Claude model (via @anthropic-ai/sdk) to judge
 * contextual quality and answer questions. By contract — and enforced by the
 * dependency graph — this layer consumes captured EvidenceRecords ONLY and has
 * no access to a Driver or the live page, so judgments are grounded and
 * reproducible. Advisory results may never become a confident PASS.
 */
export class StubAIClient implements AIClient {
  async judge(_concern: string, _evidence: EvidenceRecord[], _intent?: Intent): Promise<AIJudgment> {
    return {
      schemaVersion: SCHEMA_VERSION,
      verdict: "UNKNOWN",
      reliability: "advisory",
      confidence: "low",
      reason: "AI judgment not implemented (scaffold stub).",
      evidenceRefs: [],
    };
  }

  async explain(_question: string, _evidence: EvidenceRecord[]): Promise<GroundedAnswer> {
    return {
      answer: "Explanation not implemented (scaffold stub).",
      evidenceRefs: [],
      confidence: "low",
    };
  }
}

export function createAIClient(): AIClient {
  return new StubAIClient();
}
