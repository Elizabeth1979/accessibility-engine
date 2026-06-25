import { existsSync, readFileSync } from "node:fs";
import { type IncomingMessage, type ServerResponse, createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { join } from "node:path";
import { createAIClient } from "@aee/ai";
import type { EvidenceRecord, GroundedAnswer, Report } from "@aee/core";
import { renderReportHtml, renderTerminalSummary } from "@aee/reporter";

/** A persisted run, as written to AEE_STORE_DIR/runs by the engine. */
export interface TriageRun {
  id: string;
  report: Report;
  evidence: EvidenceRecord[];
}

export interface TriageOptions {
  port?: number;
  /** A report to display. If omitted, the latest persisted run is loaded from `storeDir`. */
  report?: Report;
  /** Evidence the conversation is grounded in (e.g. a run's evidence). */
  evidence?: EvidenceRecord[];
  /** Directory holding persisted runs; defaults to AEE_STORE_DIR. Used only when `report` is absent. */
  storeDir?: string;
}

/**
 * Load a persisted run from a store directory — `<dir>/runs/<id>.json`, or the latest run (via the
 * `.latest` marker) when no id is given. Reads the JSON the engine wrote; no @aee/engine dependency,
 * so the triage surface still depends on @aee/core / @aee/ai / @aee/reporter only.
 */
export function loadRun(storeDir: string, id?: string): TriageRun | undefined {
  const runsDir = join(storeDir, "runs");
  let runId = id;
  if (!runId) {
    const marker = join(runsDir, ".latest");
    if (!existsSync(marker)) return undefined;
    runId = readFileSync(marker, "utf8").trim();
  }
  const path = join(runsDir, `${runId}.json`);
  return existsSync(path) ? (JSON.parse(readFileSync(path, "utf8")) as TriageRun) : undefined;
}

/**
 * Ask a grounded question about captured evidence. Shared with the MCP surface via
 * @aee/ai.explain — the AI sees evidence only.
 */
export async function ask(question: string, evidence: EvidenceRecord[] = []): Promise<GroundedAnswer> {
  return createAIClient().explain(question, evidence);
}

/** A plain-text rendering of a report (reused by the CLI/MCP surfaces). */
export function summarize(report: Report): string {
  return renderTerminalSummary(report);
}

export interface TriageServer {
  url: string;
  port: number;
  close(): Promise<void>;
}

function renderPage(report: Report | undefined): string {
  const findings = report
    ? renderReportHtml(report)
    : '<p class="empty">No report loaded. Run <code>investigate</code> with <code>AEE_STORE_DIR</code> set, then start triage with the same directory.</p>';
  return PAGE.replace("__FINDINGS__", () => findings);
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
 * Start the local "chat with your report" web UI: renders the report as accessible HTML and answers
 * grounded questions over its evidence via ask(). With no `report`, it loads the latest persisted run
 * from `storeDir` (or AEE_STORE_DIR). Local by default; returns a handle so callers and tests can read
 * the port and close it.
 */
export async function startTriageServer(opts: TriageOptions = {}): Promise<TriageServer> {
  let report = opts.report;
  let evidence = opts.evidence ?? [];
  if (!report) {
    const dir = opts.storeDir ?? process.env.AEE_STORE_DIR;
    const run = dir ? loadRun(dir) : undefined;
    if (run) {
      report = run.report;
      evidence = run.evidence;
    }
  }
  const page = renderPage(report);

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

// The page is itself built to be accessible — fitting for an accessibility tool: semantic landmarks,
// a labelled input, an aria-live region for answers, status as text (never colour alone), and
// keyboard operation. The host document + styling live here; the findings fragment comes from the reporter.
const PAGE = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width, initial-scale=1" />
<title>AEE — chat with your report</title>
<style>
  body { font: 15px/1.55 system-ui, sans-serif; max-width: 820px; margin: 2rem auto; padding: 0 1rem; color: #18181b; }
  h1 { font-size: 1.4rem; }
  .meta { color: #52525b; font-size: .85rem; }
  .summary { font-weight: 600; }
  ul.findings { list-style: none; padding: 0; }
  .finding { border: 1px solid #e4e4e7; border-left-width: 4px; border-radius: 8px; padding: .6rem .9rem; margin: .6rem 0; }
  .finding.fail { border-left-color: #dc2626; }
  .finding.warn { border-left-color: #d97706; }
  .finding.pass { border-left-color: #16a34a; }
  .finding.unknown { border-left-color: #71717a; }
  .head { margin: 0 0 .25rem; }
  .badge { font-size: .72rem; font-weight: 700; letter-spacing: .03em; padding: .1rem .45rem; border-radius: 999px; color: #fff; }
  .badge.fail { background: #dc2626; } .badge.warn { background: #b45309; } .badge.pass { background: #15803d; } .badge.unknown { background: #52525b; }
  .reason { margin: .25rem 0; } .fix { margin: .25rem 0; color: #1e3a8a; }
  code { background: #f4f4f5; padding: .05rem .3rem; border-radius: 4px; }
  form.q { display: flex; gap: .5rem; margin: 1rem 0; }
  input { flex: 1; padding: .55rem; border: 1px solid #a1a1aa; border-radius: 6px; font: inherit; }
  button { padding: .55rem 1.1rem; border-radius: 6px; border: 1px solid #4f46e5; background: #4f46e5; color: #fff; cursor: pointer; font: inherit; }
  button:focus-visible, input:focus-visible { outline: 3px solid #c7d2fe; outline-offset: 1px; }
  .a { border-left: 3px solid #4f46e5; padding: .35rem .75rem; margin: .5rem 0; background: #f5f3ff; }
  .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
</style>
</head>
<body>
<header>
  <h1>AEE — chat with your report</h1>
  <p class="meta">A grounded conversation over captured evidence. Answers come from the evidence only.</p>
</header>
<main>
  <section aria-labelledby="findings-h">
    <h2 id="findings-h">Findings</h2>
    __FINDINGS__
  </section>
  <section aria-labelledby="ask-h">
    <h2 id="ask-h">Ask</h2>
    <form class="q" id="ask-form">
      <label class="visually-hidden" for="q">Ask a question about the findings</label>
      <input id="q" name="q" placeholder="Why did the cart button fail?" autocomplete="off" autofocus />
      <button type="submit">Ask</button>
    </form>
    <div id="log" aria-live="polite" aria-atomic="false"></div>
  </section>
</main>
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
  document.getElementById('ask-form').addEventListener('submit', (e) => { e.preventDefault(); ask(); });
</script>
</body>
</html>`;
