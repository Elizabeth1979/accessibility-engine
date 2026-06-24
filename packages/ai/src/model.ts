import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";

/**
 * The model's raw assessment of one accessibility concern. Reliability is NOT
 * asked of the model — it's set by the judge from the concern's coverage tier.
 */
export const zAssessment = z.object({
  verdict: z.enum(["PASS", "FAIL", "WARN", "UNKNOWN"]),
  confidence: z.enum(["high", "medium", "low"]),
  reason: z.string(),
  suggestedFix: z.string().optional(),
});
export type Assessment = z.infer<typeof zAssessment>;

/** Structured-outputs JSON Schema mirroring zAssessment (additionalProperties:false required). */
const ASSESSMENT_JSON_SCHEMA = {
  type: "object",
  properties: {
    verdict: { type: "string", enum: ["PASS", "FAIL", "WARN", "UNKNOWN"] },
    confidence: { type: "string", enum: ["high", "medium", "low"] },
    reason: { type: "string" },
    suggestedFix: { type: "string" },
  },
  required: ["verdict", "confidence", "reason"],
  additionalProperties: false,
} as const;

/**
 * The model seam. The AI client depends on this interface, not on the SDK
 * directly — so tests inject a fake and CI never needs an API key.
 */
/** An image passed to a vision-capable model alongside the text prompt. */
export interface ImageInput {
  /** Base64-encoded image bytes (no data: prefix). */
  data: string;
  /** e.g. "image/png". */
  mediaType: string;
}

export interface JudgmentModel {
  readonly name: string;
  /** Judge a concern → a structured assessment. Vision concerns pass `images`. */
  assess(system: string, user: string, images?: ImageInput[]): Promise<Assessment>;
  /** Answer a grounded question → free-form text (the conversation surface). */
  answer(system: string, user: string): Promise<string>;
}

export interface ClaudeOptions {
  apiKey?: string;
  /** Defaults to Anthropic's most capable model. */
  modelId?: string;
  /** Inject a preconfigured client (tests / custom transport). */
  client?: Anthropic;
}

/** Real model: judges with Claude via structured outputs, grounded in the prompt only. */
export class ClaudeJudgmentModel implements JudgmentModel {
  readonly name: string;
  readonly #client: Anthropic;
  readonly #modelId: string;

  constructor(opts: ClaudeOptions = {}) {
    this.#client = opts.client ?? new Anthropic(opts.apiKey ? { apiKey: opts.apiKey } : {});
    this.#modelId = opts.modelId ?? "claude-opus-4-8";
    this.name = `claude:${this.#modelId}`;
  }

  async assess(system: string, user: string, images?: ImageInput[]): Promise<Assessment> {
    const content: Anthropic.MessageParam["content"] =
      images && images.length > 0
        ? [
            { type: "text" as const, text: user },
            ...images.map((image) => ({
              type: "image" as const,
              source: {
                type: "base64" as const,
                media_type: image.mediaType as "image/png",
                data: image.data,
              },
            })),
          ]
        : user;
    const response = await this.#client.messages.create({
      model: this.#modelId,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content }],
      output_config: { format: { type: "json_schema", schema: ASSESSMENT_JSON_SCHEMA } },
    });

    if (response.stop_reason === "refusal") {
      return { verdict: "UNKNOWN", confidence: "low", reason: "Model declined to assess (refusal)." };
    }
    const text = response.content.find(
      (block): block is Anthropic.TextBlock => block.type === "text",
    )?.text;
    if (!text) {
      return { verdict: "UNKNOWN", confidence: "low", reason: "No structured output was returned." };
    }
    return zAssessment.parse(JSON.parse(text));
  }

  async answer(system: string, user: string): Promise<string> {
    const response = await this.#client.messages.create({
      model: this.#modelId,
      max_tokens: 16000,
      thinking: { type: "adaptive" },
      system,
      messages: [{ role: "user", content: user }],
    });
    if (response.stop_reason === "refusal") return "I cannot answer that.";
    const text = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("\n")
      .trim();
    return text || "(no answer was returned)";
  }
}

/** Returned when no model or API key is configured. Always UNKNOWN — never a guessed PASS. */
export class StubJudgmentModel implements JudgmentModel {
  readonly name = "stub";
  async assess(): Promise<Assessment> {
    return {
      verdict: "UNKNOWN",
      confidence: "low",
      reason: "AI judgment not configured (no model or ANTHROPIC_API_KEY).",
    };
  }
  async answer(): Promise<string> {
    return "AI conversation is not configured (no model or ANTHROPIC_API_KEY).";
  }
}

/** Deterministic model for tests — returns a fixed assessment. */
export function fixedModel(assessment: Assessment, name = "fixed", answerText?: string): JudgmentModel {
  return {
    name,
    assess: async () => assessment,
    answer: async () => answerText ?? assessment.reason,
  };
}
