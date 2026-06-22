import {
  type AIClient,
  type AIJudgment,
  type EvidenceRecord,
  type GroundedAnswer,
  type Intent,
  type Reliability,
  SCHEMA_VERSION,
} from "@aee/core";
import {
  type Assessment,
  ClaudeJudgmentModel,
  type JudgmentModel,
  StubJudgmentModel,
} from "./model.js";
import { buildSystemPrompt, buildUserPrompt } from "./prompt.js";

/**
 * Integrity guard: an advisory judgment may never assert a confident PASS.
 * If the model returns PASS on an advisory-tier concern, downgrade to UNKNOWN.
 */
export function enforceIntegrity(judgment: AIJudgment): AIJudgment {
  if (judgment.reliability === "advisory" && judgment.verdict === "PASS") {
    return { ...judgment, verdict: "UNKNOWN", reason: `${judgment.reason} (advisory: cannot certify PASS)` };
  }
  return judgment;
}

function uniqueRefs(evidence: EvidenceRecord[]): string[] {
  return [...new Set(evidence.map((e) => e.interactionId))];
}

function toJudgment(
  assessment: Assessment,
  evidence: EvidenceRecord[],
  reliability: Reliability,
): AIJudgment {
  return enforceIntegrity({
    schemaVersion: SCHEMA_VERSION,
    verdict: assessment.verdict,
    reliability,
    confidence: assessment.confidence,
    reason: assessment.reason,
    suggestedFix: assessment.suggestedFix,
    evidenceRefs: uniqueRefs(evidence),
  });
}

/**
 * AI client backed by a JudgmentModel. Consumes captured EvidenceRecords only.
 * The naming/text-alternatives wedge is Tier 1 → authoritative.
 */
export class ConcernAIClient implements AIClient {
  readonly #model: JudgmentModel;
  readonly #reliability: Reliability;

  constructor(model: JudgmentModel, reliability: Reliability = "authoritative") {
    this.#model = model;
    this.#reliability = reliability;
  }

  async judge(concern: string, evidence: EvidenceRecord[], intent?: Intent): Promise<AIJudgment> {
    if (evidence.length === 0) {
      return {
        schemaVersion: SCHEMA_VERSION,
        verdict: "UNKNOWN",
        reliability: "advisory",
        confidence: "low",
        reason: "No evidence was captured to judge.",
        evidenceRefs: [],
      };
    }
    const assessment = await this.#model.assess(
      buildSystemPrompt(concern),
      buildUserPrompt(evidence, intent),
    );
    return toJudgment(assessment, evidence, this.#reliability);
  }

  async explain(_question: string, evidence: EvidenceRecord[]): Promise<GroundedAnswer> {
    // Conversation surface is wired with the MCP/triage milestone; the judge wedge
    // does not implement it yet. Grounded-but-stub answer keeps the surface honest.
    return {
      answer: "Conversational explain() is not implemented in this milestone.",
      evidenceRefs: uniqueRefs(evidence),
      confidence: "low",
    };
  }
}

export interface CreateAIClientOptions {
  /** Inject a model (tests / custom transport). Overrides apiKey/modelId. */
  model?: JudgmentModel;
  apiKey?: string;
  modelId?: string;
  reliability?: Reliability;
}

/**
 * Build an AIClient. Uses the injected model if given; otherwise Claude when an
 * API key is available (option or ANTHROPIC_API_KEY); otherwise a stub that
 * always returns UNKNOWN — so the build and CI stay green without a key.
 */
export function createAIClient(opts: CreateAIClientOptions = {}): AIClient {
  const hasKey = Boolean(opts.apiKey || process.env.ANTHROPIC_API_KEY);
  const model =
    opts.model ??
    (hasKey ? new ClaudeJudgmentModel({ apiKey: opts.apiKey, modelId: opts.modelId }) : new StubJudgmentModel());
  return new ConcernAIClient(model, opts.reliability);
}
