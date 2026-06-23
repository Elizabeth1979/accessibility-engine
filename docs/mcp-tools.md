# AEE MCP tools

`@aee/mcp` is AEE's **agent-native** surface: a coding agent (Claude Code, Cursor, etc.) connects over MCP and runs accessibility investigations on your code by chat. It is a thin front-end over `@aee/engine` + `@aee/ai` + `@aee/fix`, so it inherits the core guarantee — **the AI sees captured evidence only, never the live page** — and the local-first default (no API key).

## Running it

Build the workspace, then start the server over stdio:

```bash
pnpm build
node packages/mcp/dist/bin.js     # or `aee-mcp` once the package is linked/installed
```

`investigate` launches headless Chromium to capture, and judges on the configured model. For the no-key local path, set `AEE_LLM_PROVIDER=local` (Ollama `gemma4:e4b` by default; see the README). Register it with your agent like any stdio MCP server:

```json
{
  "mcpServers": {
    "aee": {
      "command": "node",
      "args": ["/absolute/path/to/accessibility-engine/packages/mcp/dist/bin.js"],
      "env": { "AEE_LLM_PROVIDER": "local" }
    }
  }
}
```

## Tools

| Tool | Input | Returns |
| --- | --- | --- |
| `investigate` | `target` (HTML to capture and judge; URL navigation is a later phase) | A rendered report: one graded verdict per element with a suggested fix. Stores the run. |
| `findings` | `runId?` (defaults to the latest run) | The run's verdicts (status, reliability, suggested fix, target element). |
| `evidence` | `runId?` | The captured evidence records behind a run. |
| `explain` | `question`, `runId?` | A grounded answer drawn only from the run's evidence. |
| `suggest_fix` | `runId?` | `FixPlan`s for the run's failing findings — element selector, the attribute to set, and before → after. |
| `apply_fix` | `runId?` | Placeholder (Phase D): AEE emits targeted plans; the agent applies them to source and opens a PR. |

## The intended flow

1. `investigate` a page → a graded report with suggested fixes.
2. `explain` a finding → understand *why* it failed, grounded in evidence.
3. `suggest_fix` → get targeted `FixPlan`s (selector + attribute + better value).
4. The agent applies the fixes to source and opens a PR — AEE provides the plan and a `gh` PR scaffold via `@aee/fix`'s `proposePr`.

## Example conversation

```
"Investigate this checkout page."   (paste the page HTML)
   → investigate → 5 checked · 1 pass · 4 fail · 0 unknown · release HOLD

"Why did the cart icon button fail?"
   → explain → "Its accessible name is 'button', which doesn't say what it does.
     Grounded in the captured evidence for #cart in the header."

"Give me the fixes."
   → suggest_fix → [ set aria-label on #cart to "Open cart drawer" (was "button"), … ]
   → the agent edits the source and opens a PR (proposePr scaffolds the gh commands).
```

## Design notes

- The conversational capability is `@aee/ai.explain(question, evidence)`; the MCP server and the local triage UI are both thin front-ends over it — no duplicated chat logic.
- The server is built by `createServer()` and connected to a transport: `StdioServerTransport` in production (`bin.ts`), an in-memory transport in tests.
