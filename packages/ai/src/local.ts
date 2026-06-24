import { type Assessment, type ImageInput, type JudgmentModel, zAssessment } from "./model.js";

export interface LocalOptions {
  /** OpenAI-compatible base URL. Defaults to Ollama (http://localhost:11434/v1). */
  baseUrl?: string;
  /** Model name as the local runtime knows it. Defaults to "gemma4:e4b" (Ollama). */
  model?: string;
  /** Bearer token; most local runtimes ignore it, some (vLLM, cloud) require it. */
  apiKey?: string;
  /** Sampling temperature; 0 for the most repeatable judgments. */
  temperature?: number;
  /** Per-request timeout in ms (a cold local model can be slow on first load). */
  timeoutMs?: number;
}

const DEFAULT_BASE_URL = "http://localhost:11434/v1";
const DEFAULT_MODEL = "gemma4:e4b";

/**
 * Appended to the system prompt so a local model (which has no API-level schema
 * enforcement, unlike Claude's structured outputs) emits a parseable object.
 */
const JSON_DIRECTIVE = [
  "",
  "Respond with ONLY a single JSON object, no markdown and no code fences.",
  "Always include verdict, confidence, and reason — even when the verdict is PASS.",
  "Include suggestedFix whenever the verdict is not PASS.",
  'Example: {"verdict":"FAIL","confidence":"high","reason":"...","suggestedFix":"..."}',
].join("\n");

/**
 * Local / self-hosted model via the OpenAI-compatible chat API — Ollama, LM Studio,
 * llama.cpp, vLLM, and so on. No API key and no cloud: the model runs on your machine.
 * Any transport or parse failure returns UNKNOWN (never a guessed PASS), so a missing
 * or slow server degrades safely instead of crashing a run.
 */
export class LocalJudgmentModel implements JudgmentModel {
  readonly name: string;
  readonly #baseUrl: string;
  readonly #model: string;
  readonly #apiKey: string | undefined;
  readonly #temperature: number;
  readonly #timeoutMs: number;

  constructor(opts: LocalOptions = {}) {
    this.#baseUrl = (opts.baseUrl ?? DEFAULT_BASE_URL).replace(/\/+$/, "");
    this.#model = opts.model ?? DEFAULT_MODEL;
    this.#apiKey = opts.apiKey;
    this.#temperature = opts.temperature ?? 0;
    this.#timeoutMs = opts.timeoutMs ?? 120_000;
    this.name = `local:${this.#model}`;
  }

  async assess(system: string, user: string, images?: ImageInput[]): Promise<Assessment> {
    const userContent =
      images && images.length > 0
        ? [
            { type: "text", text: user },
            ...images.map((image) => ({
              type: "image_url",
              image_url: { url: `data:${image.mediaType};base64,${image.data}` },
            })),
          ]
        : user;
    let raw: string;
    try {
      raw = await this.#chat(system + JSON_DIRECTIVE, userContent, true);
    } catch (err) {
      return unknown(`Local model unreachable or errored (${this.name}): ${messageOf(err)}`);
    }
    const assessment = normalize(extractJson(raw));
    if (!assessment) return unknown(`Local model returned no usable verdict (${this.name}).`);
    return zAssessment.parse(assessment);
  }

  async answer(system: string, user: string): Promise<string> {
    try {
      const text = (await this.#chat(system, user, false)).trim();
      return text || "(no answer was returned)";
    } catch (err) {
      return `Local model unreachable or errored (${this.name}): ${messageOf(err)}`;
    }
  }

  async #chat(system: string, userContent: unknown, json: boolean): Promise<string> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), this.#timeoutMs);
    try {
      const res = await fetch(`${this.#baseUrl}/chat/completions`, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(this.#apiKey ? { authorization: `Bearer ${this.#apiKey}` } : {}),
        },
        body: JSON.stringify({
          model: this.#model,
          stream: false,
          temperature: this.#temperature,
          ...(json ? { response_format: { type: "json_object" } } : {}),
          messages: [
            { role: "system", content: system },
            { role: "user", content: userContent },
          ],
        }),
        signal: controller.signal,
      });
      if (!res.ok) throw new Error(`HTTP ${res.status} ${res.statusText}`);
      const data = (await res.json()) as { choices?: { message?: { content?: string } }[] };
      const content = data.choices?.[0]?.message?.content;
      if (!content) throw new Error("response had no choices[0].message.content");
      return content;
    } finally {
      clearTimeout(timer);
    }
  }
}

function unknown(reason: string): Assessment {
  return { verdict: "UNKNOWN", confidence: "low", reason };
}

const VERDICTS = new Set(["PASS", "FAIL", "WARN", "UNKNOWN"]);
const CONFIDENCES = new Set(["high", "medium", "low"]);

/**
 * Coerce a local model's object into a canonical Assessment. Small local models
 * often answer a clear PASS with just {"verdict":"PASS"} — we keep the model's real
 * verdict and fill confidence/reason rather than discarding a valid judgment.
 * Returns null only when there is no recognizable verdict at all.
 */
function normalize(parsed: unknown): Assessment | null {
  if (!parsed || typeof parsed !== "object") return null;
  const o = parsed as Record<string, unknown>;
  const verdict = typeof o.verdict === "string" ? o.verdict.trim().toUpperCase() : "";
  if (!VERDICTS.has(verdict)) return null;
  const rawConfidence = typeof o.confidence === "string" ? o.confidence.trim().toLowerCase() : "";
  const confidence = CONFIDENCES.has(rawConfidence) ? rawConfidence : "low";
  const reason =
    typeof o.reason === "string" && o.reason.trim()
      ? o.reason.trim()
      : `Local model returned a bare ${verdict} verdict.`;
  const suggestedFix =
    typeof o.suggestedFix === "string" && o.suggestedFix.trim() ? o.suggestedFix.trim() : undefined;
  return { verdict, confidence, reason, suggestedFix } as Assessment;
}

function messageOf(err: unknown): string {
  return err instanceof Error ? err.message : String(err);
}

/** Tolerant JSON extraction: clean JSON, or the first {...} block embedded in prose. */
function extractJson(text: string): unknown {
  const trimmed = text.trim();
  try {
    return JSON.parse(trimmed);
  } catch {
    const start = trimmed.indexOf("{");
    const end = trimmed.lastIndexOf("}");
    if (start >= 0 && end > start) {
      try {
        return JSON.parse(trimmed.slice(start, end + 1));
      } catch {
        return undefined;
      }
    }
    return undefined;
  }
}
