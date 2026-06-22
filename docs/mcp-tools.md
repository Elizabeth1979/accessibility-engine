# MCP tool surface

`@aee/mcp` is the **agent-native** surface: it exposes AEE to the coding agent you already use (Claude Code, Copilot) so you operate the engine by chat. Every tool is grounded in captured evidence — the agent cannot make the AI see the live page.

## Tools (planned)

| Tool | Purpose |
| --- | --- |
| `aee.investigate` | Run an investigation against a target/checkpoint; returns a run id + summary. |
| `aee.findings` | List findings for a run (verdict, tier, reliability, suggested fix). |
| `aee.evidence` | Fetch the `EvidenceRecord`s (and artifacts by reference) behind a finding. |
| `aee.explain` | Ask a grounded question about a finding; answered from evidence only. |
| `aee.suggestFix` | Produce a `FixPlan` (e.g. a better accessible name) for a finding. |
| `aee.applyFix` | Apply a `FixPlan` as a safe edit and open a PR via `gh`. |

## Example conversation

```
"Investigate the checkout page for accessibility."
   → aee.investigate → run #42, 3 findings (1 FAIL, 2 WARN)

"Why did the cart icon button fail?"
   → aee.explain → "Its accessible name is 'button'. Evidence: a11y node #e17,
     screenshot #s09 shows a cart glyph. In context (intent: cart drawer) a
     user can't tell what it does."

"Apply the suggested name and open a PR."
   → aee.suggestFix → FixPlan { aria-label: "Open cart drawer" }
   → aee.applyFix → branch + PR via gh
```

## Design notes

- The conversational capability is `@aee/ai.explain(question, evidence)`; the MCP server and the local triage UI are both thin front-ends over it (no duplicated chat logic).
- Tools return structured, schema-validated payloads (see `/schemas`) so agents can chain them reliably.
