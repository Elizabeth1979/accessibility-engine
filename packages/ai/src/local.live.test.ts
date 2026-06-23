import assert from "node:assert/strict";
import { test } from "node:test";
import { NAMING_FIXTURES, createAIClient } from "./index.js";

// Live end-to-end against a LOCAL model (Ollama / LM Studio / llama.cpp via the
// OpenAI-compatible API) — no API key, no cloud. Skipped unless a local server is
// reachable, so CI and offline builds stay green. This is the no-key counterpart
// to live.test.ts (which runs against Claude when ANTHROPIC_API_KEY is set).
const BASE_URL = process.env.AEE_LLM_BASE_URL ?? "http://localhost:11434/v1";

async function localModelReachable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 1500);
    const res = await fetch(`${BASE_URL}/models`, { signal: controller.signal });
    clearTimeout(timer);
    return res.ok;
  } catch {
    return false;
  }
}

const skip = (await localModelReachable()) ? false : "no local OpenAI-compatible model server reachable";

for (const fixture of NAMING_FIXTURES) {
  test(`local: ${fixture.label}`, { skip }, async () => {
    const ai = createAIClient({ provider: "local" });
    const verdict = await ai.judge("accessible-name", fixture.evidence, fixture.intent);
    if (fixture.expect === "PASS") {
      assert.equal(verdict.verdict, "PASS", verdict.reason);
    } else {
      assert.notEqual(verdict.verdict, "PASS", verdict.reason);
      assert.ok(
        verdict.suggestedFix && verdict.suggestedFix.length > 0,
        "a non-PASS verdict should propose a concrete better name",
      );
    }
  });
}
