# Fuller triage UI — design

Future item ③ from [`docs/ROADMAP.md`](../ROADMAP.md). Implemented 2026-06-24.

## Goal

`@aee/triage` was a working but minimal "chat with your report" shell: it required the caller to pass
a report and rendered it as terminal text in a `<pre>`. This makes it a usable local tool: it **loads
a persisted run from disk on its own**, renders the findings as **structured, accessible HTML**, and
ships a **runnable bin** — without breaking the dependency boundary.

## Approach

Reuse the disk persistence already built (the engine writes runs to `AEE_STORE_DIR/runs/<id>.json`).
The triage server reads that JSON directly via `fs` — it does **not** depend on `@aee/engine`, so the
graph invariant holds (`@aee/triage → @aee/core / @aee/ai / @aee/reporter` only). The report renders to
HTML through a new `renderReportHtml` in `@aee/reporter` (rendering belongs there, next to
`renderTerminalSummary`). Stack stays vanilla — a Node `http` server and a framework-free page.

## Components

- **`@aee/reporter` `renderReportHtml(report)`** — an accessible HTML fragment: a summary line plus one
  item per finding (status badge, grounded reason, suggested fix, target element). The status is always
  text, never colour alone.
- **`@aee/triage` `loadRun(storeDir, id?)`** — reads `<dir>/runs/<id>.json`, or the latest run via the
  `.latest` marker; returns `undefined` (never throws) when absent.
- **`startTriageServer({ storeDir?, report?, evidence? })`** — when no `report` is passed, loads the
  latest run from `storeDir` (default `AEE_STORE_DIR`). `GET /` serves the page; `POST /ask` answers via
  `@aee/ai.explain` over the run's evidence (the AI still sees evidence only).
- **`bin.ts` → `aee-triage`** (and `pnpm triage`) — starts the server, prints the URL.

## Accessibility (the UI is itself exemplary)

Fitting for an accessibility tool: semantic landmarks (`header`/`main`/`section` with labelled
headings), a labelled input, an `aria-live="polite"` log so answers are announced, status conveyed as
text (not colour alone), visible focus indicators, and full keyboard operation (form submit on Enter).

## Testing

Deterministic, no browser: `loadRun` reads the latest persisted run and returns `undefined` for a
missing id; the server, pointed at a store directory, loads the run and serves HTML containing the
status badge, the reason, the suggested fix, the target, and the `aria-live` region. The existing
`ask()` and report-over-HTTP tests are retained. Verified live: the server loads a persisted run and
serves the accessible findings.

## Scope

In scope: load + render a persisted run, and the grounded chat. Deferred: in-UI apply-fix (needs the
user's source file), an evidence browser, and multi-run history/navigation — a larger front-end effort
left to a future pass.
