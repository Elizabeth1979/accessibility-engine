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
import { LocalJudgmentModel, type LocalOptions } from "./local.js";
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

/** Which model backs the AI client. "auto" = Claude when a key is present, else stub. */
export type AIProvider = "auto" | "local" | "claude" | "stub";

export interface CreateAIClientOptions {
  /** Inject a model (tests / custom transport). Overrides every other selector. */
  model?: JudgmentModel;
  /** Pick a backend explicitly. Defaults to AEE_LLM_PROVIDER, else "auto". */
  provider?: AIProvider;
  /** Local / self-hosted (Ollama, LM Studio, ...) options; presence implies provider "local". */
  local?: LocalOptions;
  apiKey?: string;
  modelId?: string;
  reliability?: Reliability;
}

/**
 * Build an AIClient. Selection order:
 *   1. an injected `model` (tests / custom transport);
 *   2. provider "local" (or any `local` / AEE_LLM_* config) → a local, no-key model;
 *   3. provider "claude" or a present API key → Claude;
 *   4. otherwise a stub that always returns UNKNOWN — so CI stays green with no key.
 * The provider is also read from AEE_LLM_PROVIDER, so the whole engine can be pointed
 * at a local model with one env var and no code change.
 */
export function createAIClient(opts: CreateAIClientOptions = {}): AIClient {
  return new ConcernAIClient(resolveModel(opts), opts.reliability);
}

function resolveModel(opts: CreateAIClientOptions): JudgmentModel {
  if (opts.model) return opts.model;

  const provider = opts.provider ?? (process.env.AEE_LLM_PROVIDER as AIProvider | undefined) ?? "auto";
  const wantsLocal = provider === "local" || Boolean(opts.local);

  if (wantsLocal) {
    return new LocalJudgmentModel({
      baseUrl: opts.local?.baseUrl ?? process.env.AEE_LLM_BASE_URL,
      model: opts.local?.model ?? process.env.AEE_LLM_MODEL,
      apiKey: opts.local?.apiKey ?? process.env.AEE_LLM_API_KEY,
      temperature: opts.local?.temperature,
      timeoutMs: opts.local?.timeoutMs,
    });
  }
  if (provider === "stub") return new StubJudgmentModel();

  const apiKey = opts.apiKey ?? process.env.ANTHROPIC_API_KEY;
  if (provider === "claude" || apiKey) {
    return new ClaudeJudgmentModel({ apiKey: opts.apiKey, modelId: opts.modelId });
  }
  return new StubJudgmentModel();
}
