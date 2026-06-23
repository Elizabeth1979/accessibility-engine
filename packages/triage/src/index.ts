import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, GroundedAnswer, Report } from "@aee/core";
import { renderTerminalSummary } from "@aee/reporter";

export interface TriageOptions {
  port?: number;
  report?: Report;
}

/**
 * Ask a grounded question about captured evidence. Shared with the MCP surface
 * via @aee/ai.explain — the AI sees evidence only. (Scoping a whole report's
 * evidence to the conversation lands with the evidence store.)
 */
export async function ask(question: string, evidence: EvidenceRecord[] = []): Promise<GroundedAnswer> {
  return createAIClient().explain(question, evidence);
}

/** A plain-text rendering of a report, reused by the UI shell. */
export function summarize(report: Report): string {
  return renderTerminalSummary(report);
}

/**
 * Start the local "chat with your report" web UI. The web framework is an open
 * item (local-first); Phase wires it over `ask()` above.
 */
export async function startTriageServer(_opts: TriageOptions = {}): Promise<never> {
  throw new Error("Triage UI server not implemented (scaffold stub).");
}
