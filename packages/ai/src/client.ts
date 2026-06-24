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
  type ImageInput,
  type JudgmentModel,
  StubJudgmentModel,
} from "./model.js";
import { LocalJudgmentModel, type LocalOptions } from "./local.js";
import {
  buildExplainSystemPrompt,
  buildExplainUserPrompt,
  buildSystemPrompt,
  buildUserPrompt,
} from "./prompt.js";

/**
 * Integrity guard: an advisory judgment may never assert a confident PASS.
 * If the model returns PASS on an advisory-tier concern, downgrade to UNKNOWN.
 */
/**
 * Concerns AEE can only ADVISE on, never certify (Tier 5): caption accuracy, plain-language
 * adequacy, "will a real assistive-tech user actually succeed". These are judged advisory
 * regardless of the client default, so the integrity guard downgrades any PASS to UNKNOWN —
 * AEE never green-lights what it cannot verify from the captured evidence.
 */
const ADVISORY_CONCERNS = new Set(["caption-accuracy"]);

/** Pull base64 screenshots out of vision evidence to send as images to the model. */
function collectImages(evidence: EvidenceRecord[]): ImageInput[] {
  const images: ImageInput[] = [];
  for (const record of evidence) {
    const after = record.after as { screenshot?: unknown; mediaType?: unknown } | null;
    if (after && typeof after.screenshot === "string") {
      images.push({
        data: after.screenshot,
        mediaType: typeof after.mediaType === "string" ? after.mediaType : "image/png",
      });
    }
  }
  return images;
}

/** Drop a screenshot's base64 from the text prompt — it travels as an image, not text. */
function stripImage(record: EvidenceRecord): EvidenceRecord {
  if (record.after && typeof record.after === "object" && "screenshot" in record.after) {
    const { screenshot: _screenshot, ...rest } = record.after as Record<string, unknown>;
    return { ...record, after: rest };
  }
  return record;
}

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
    const images = collectImages(evidence);
    let assessment: Assessment;
    try {
      assessment = await this.#model.assess(
        buildSystemPrompt(concern),
        buildUserPrompt(evidence.map(stripImage), intent),
        images.length > 0 ? images : undefined,
      );
    } catch (err) {
      // AI boundary: a thrown or malformed model response degrades to advisory UNKNOWN —
      // never a crash, never a guessed PASS.
      return {
        schemaVersion: SCHEMA_VERSION,
        verdict: "UNKNOWN",
        reliability: "advisory",
        confidence: "low",
        reason: `Model assessment failed or was malformed: ${err instanceof Error ? err.message : String(err)}`,
        evidenceRefs: uniqueRefs(evidence),
      };
    }
    // Tier 5 concerns are advisory no matter the client default — the guard then blocks a PASS.
    const reliability = ADVISORY_CONCERNS.has(concern) ? "advisory" : this.#reliability;
    return toJudgment(assessment, evidence, reliability);
  }

  async explain(question: string, evidence: EvidenceRecord[]): Promise<GroundedAnswer> {
    const answer = await this.#model.answer(
      buildExplainSystemPrompt(),
      buildExplainUserPrompt(question, evidence),
    );
    return {
      answer,
      evidenceRefs: uniqueRefs(evidence),
      confidence: evidence.length > 0 ? "medium" : "low",
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
