import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, GroundedAnswer, Report } from "@aee/core";
import { renderTerminalSummary } from "@aee/reporter";

export interface TriageOptions {
  port?: number;
  report?: Report;
  /** Evidence the conversation is grounded in (e.g. a run's evidence). */
  evidence?: EvidenceRecord[];
}

/**
 * Ask a grounded question about captured evidence. Shared with the MCP surface via
 * @aee/ai.explain — the AI sees evidence only.
 */
export async function ask(question: string, evidence: EvidenceRecord[] = []): Promise<GroundedAnswer> {
  return createAIClient().explain(question, evidence);
}

/** A plain-text rendering of a report, reused by the UI shell. */
export function summarize(report: Report): string {
  return renderTerminalSummary(report);
}

export interface TriageServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function renderPage(reportText: string): string {
  return PAGE.replace("__REPORT__", () => escapeHtml(reportText));
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
    });
    req.on("end", () => resolve(body));
  });
}

async function handleRequest(
  req: IncomingMessage,
  res: ServerResponse,
  page: string,
  evidence: EvidenceRecord[],
): Promise<void> {
  if (req.method === "GET" && (req.url === "/" || req.url === "/index.html")) {
    res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
    res.end(page);
    return;
  }
  if (req.method === "POST" && req.url === "/ask") {
    let question = "";
    try {
      question = (JSON.parse(await readBody(req)) as { question?: string }).question ?? "";
    } catch {
      // ignore a malformed body; treat as an empty question
    }
    const answer = await ask(question, evidence);
    res.writeHead(200, { "content-type": "application/json" });
    res.end(JSON.stringify(answer));
    return;
  }
  res.writeHead(404, { "content-type": "text/plain" });
  res.end("Not found");
}

/**
 * Start the local "chat with your report" web UI: a minimal, framework-free shell that
 * renders the report and answers grounded questions over its evidence via ask(). Local
 * by default; returns a handle so callers (and tests) can read the port and close it.
 * This is a functional shell to react to — the visual design is intentionally left open.
 */
export async function startTriageServer(opts: TriageOptions = {}): Promise<TriageServer> {
  const evidence = opts.evidence ?? [];
  const page = renderPage(opts.report ? summarize(opts.report) : "No report loaded.");

  const server = createServer((req, res) => {
    void handleRequest(req, res, page, evidence);
  });

  const port = await new Promise<number>((resolve) => {
    server.listen(opts.port ?? 0, "127.0.0.1", () => {
      const address = server.address() as AddressInfo | null;
      resolve(address ? address.port : 0);
    });
  });

  return {
    port,
    url: `http://127.0.0.1:${port}/`,
    close: () =>
      new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      }),
  };
}

const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AEE — chat with your report</title>
<style>
  body { font: 14px/1.5 system-ui, sans-serif; max-width: 760px; margin: 2rem auto; padding: 0 1rem; color: #111; }
  pre { background: #f4f4f5; padding: 1rem; border-radius: 8px; white-space: pre-wrap; }
  .q { display: flex; gap: .5rem; margin: 1rem 0; }
  input { flex: 1; padding: .5rem; border: 1px solid #ccc; border-radius: 6px; }
  button { padding: .5rem 1rem; border-radius: 6px; border: 1px solid #6366f1; background: #6366f1; color: #fff; cursor: pointer; }
  .a { border-left: 3px solid #6366f1; padding: .25rem .75rem; margin: .5rem 0; background: #fafafa; white-space: pre-wrap; }
  .meta { color: #666; font-size: 12px; margin: .25rem 0 1rem; }
</style>
</head>
<body>
<h1>AEE — chat with your report</h1>
<p class="meta">A grounded conversation over captured evidence. Answers come from the evidence only.</p>
<h2>Findings</h2>
<pre id="report">__REPORT__</pre>
<h2>Ask</h2>
<div class="q"><input id="q" placeholder="Why did the cart button fail?" autofocus /><button id="send">Ask</button></div>
<div id="log"></div>
<script>
  const log = document.getElementById('log');
  const q = document.getElementById('q');
  function add(text, cls) { const el = document.createElement('div'); el.className = cls; el.textContent = text; log.appendChild(el); }
  async function ask() {
    const question = q.value.trim();
    if (!question) return;
    add('You: ' + question, 'meta');
    q.value = '';
    try {
      const res = await fetch('/ask', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ question }) });
      const data = await res.json();
      add(data.answer, 'a');
      add('confidence: ' + data.confidence + ' · evidence: ' + (data.evidenceRefs || []).join(', '), 'meta');
    } catch (e) { add('Error: ' + (e && e.message ? e.message : e), 'a'); }
  }
  document.getElementById('send').onclick = ask;
  q.addEventListener('keydown', (e) => { if (e.key === 'Enter') ask(); });
</script>
</body>
</html>`;
