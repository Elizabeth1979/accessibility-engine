import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, FixPlan, GroundedAnswer, Report, Verdict } from "@aee/core";
import { getRun, investigate as runInvestigation, latestRun } from "@aee/engine";
import { planFix } from "@aee/fix";
import { renderTerminalSummary } from "@aee/reporter";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { z } from "zod";

export interface McpToolSpec {
  name: string;
  description: string;
}

/** The AEE MCP tool surface (see docs/mcp-tools.md). Names match the registered tools. */
export const AEE_MCP_TOOLS: McpToolSpec[] = [
  { name: "investigate", description: "Run an accessibility investigation against HTML (URL navigation is a later phase)." },
  { name: "findings", description: "List findings for a run (verdict, reliability, suggested fix); defaults to the latest." },
  { name: "evidence", description: "Fetch the evidence records behind a run; defaults to the latest." },
  { name: "explain", description: "Ask a grounded question about a run; answered from evidence only." },
  { name: "suggest_fix", description: "Produce FixPlans (a concrete better value) for a run's failing findings." },
  { name: "apply_fix", description: "Apply a FixPlan as a safe edit and open a PR via gh (Phase D — not yet implemented)." },
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

const text = (value: string) => ({ content: [{ type: "text" as const, text: value }] });

/**
 * Build the AEE MCP server with its tools registered. A thin front-end over the
 * engine + @aee/ai + @aee/fix, so it inherits the evidence-only guarantee. Returned
 * unconnected so callers (stdio in production, an in-memory transport in tests) choose
 * the transport.
 */
export function createServer(opts: McpServerOptions = {}): McpServer {
  const server = new McpServer({ name: opts.name ?? "aee", version: "0.1.0" });

  server.registerTool(
    "investigate",
    {
      title: "Investigate",
      description: "Run an accessibility investigation. Pass HTML to capture and judge it.",
      inputSchema: { target: z.string().describe("HTML to investigate (or a URL; navigation is a later phase).") },
    },
    async ({ target }) => text(renderTerminalSummary(await investigate(target))),
  );

  server.registerTool(
    "findings",
    {
      title: "Findings",
      description: "List the findings for a run; defaults to the latest investigation.",
      inputSchema: { runId: z.string().optional() },
    },
    async ({ runId }) => text(JSON.stringify(findings(runId), null, 2)),
  );

  server.registerTool(
    "evidence",
    {
      title: "Evidence",
      description: "Fetch the captured evidence records behind a run; defaults to the latest.",
      inputSchema: { runId: z.string().optional() },
    },
    async ({ runId }) => text(JSON.stringify(evidence(runId), null, 2)),
  );

  server.registerTool(
    "explain",
    {
      title: "Explain",
      description: "Ask a grounded question about a run's findings; answered from evidence only.",
      inputSchema: { question: z.string(), runId: z.string().optional() },
    },
    async ({ question, runId }) => text((await explain(question, evidence(runId))).answer),
  );

  server.registerTool(
    "suggest_fix",
    {
      title: "Suggest fix",
      description: "Produce FixPlans for a run's failing findings (a concrete better value to apply).",
      inputSchema: { runId: z.string().optional() },
    },
    async ({ runId }) => {
      const plans = findings(runId)
        .map((finding) => suggestFix(finding))
        .filter((plan): plan is FixPlan => plan !== null);
      return text(JSON.stringify(plans, null, 2));
    },
  );

  server.registerTool(
    "apply_fix",
    {
      title: "Apply fix",
      description: "Apply a FixPlan as a safe edit and open a PR via gh.",
      inputSchema: { runId: z.string().optional() },
    },
    async () => text("apply_fix is not implemented yet (Phase D)."),
  );

  return server;
}

/** Start the AEE MCP server over stdio. */
export async function startServer(opts: McpServerOptions = {}): Promise<void> {
  await createServer(opts).connect(new StdioServerTransport());
}
