import { createAIClient } from "@aee/ai";
import type { FixPlan, GroundedAnswer, Report, Verdict } from "@aee/core";
import { planFix } from "@aee/fix";
import { buildReport } from "@aee/reporter";

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

/** Phase: drive @aee/playwright, collect evidence, run @aee/judges with the AI client. */
export async function investigate(_target: string): Promise<Report> {
  const ai = createAIClient();
  void ai; // grounded judgments wired in the walking skeleton
  return buildReport([]);
}

/** Conversation surface — thin wrapper over @aee/ai.explain (evidence only). */
export async function explain(question: string): Promise<GroundedAnswer> {
  return createAIClient().explain(question, []);
}

export function suggestFix(finding: Verdict): FixPlan | null {
  return planFix(finding);
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
