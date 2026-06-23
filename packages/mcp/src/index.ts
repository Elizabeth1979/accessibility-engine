import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, FixPlan, GroundedAnswer, Report, Verdict } from "@aee/core";
import { getRun, investigate as runInvestigation, latestRun } from "@aee/engine";
import { planFix } from "@aee/fix";

export interface McpToolSpec {
  name: string;
  description: string;
}

/** The AEE MCP tool surface (see docs/mcp-tools.md). */
export const AEE_MCP_TOOLS: McpToolSpec[] = [
  { name: "aee.investigate", description: "Run an accessibility investigation against a target or checkpoint." },
  { name: "aee.findings", description: "List findings for a run (verdict, tier, reliability, suggested fix)." },
  { name: "aee.evidence", description: "Fetch the evidence records (and artifacts by reference) behind a finding." },
  { name: "aee.explain", description: "Ask a grounded question about a finding; answered from evidence only." },
  { name: "aee.suggestFix", description: "Produce a FixPlan (e.g. a better accessible name) for a finding." },
  { name: "aee.applyFix", description: "Apply a FixPlan as a safe edit and open a PR via gh." },
];

export function listTools(): McpToolSpec[] {
  return AEE_MCP_TOOLS;
}

/** Run an investigation via the engine (capture → judge → report) and store the run. */
export async function investigate(target: string): Promise<Report> {
  const html = target.trimStart().startsWith("<") ? target : undefined;
  const run = await runInvestigation({ html });
  return run.report;
}

/** Conversation surface — thin wrapper over @aee/ai.explain (evidence only). */
export async function explain(question: string, evidence: EvidenceRecord[] = []): Promise<GroundedAnswer> {
  return createAIClient().explain(question, evidence);
}

export function suggestFix(finding: Verdict): FixPlan | null {
  return planFix(finding);
}

/** Findings for a run (defaults to the latest investigation). */
export function findings(runId?: string): Verdict[] {
  const run = runId ? getRun(runId) : latestRun();
  return run?.report.findings ?? [];
}

/** Evidence records behind a run (defaults to the latest investigation). */
export function evidence(runId?: string): EvidenceRecord[] {
  const run = runId ? getRun(runId) : latestRun();
  return run?.evidence ?? [];
}

export interface McpServerOptions {
  name?: string;
}

/**
 * Start the AEE MCP server over stdio. Phase: wire @modelcontextprotocol/sdk and
 * register the tools above. The server is a thin front-end over @aee/ai +
 * @aee/reporter + @aee/fix, so it inherits the evidence-only guarantee.
 */
export async function startServer(_opts: McpServerOptions = {}): Promise<never> {
  throw new Error(
    `MCP transport not implemented (scaffold stub). Tools: ${AEE_MCP_TOOLS.map((t) => t.name).join(", ")}`,
  );
}
