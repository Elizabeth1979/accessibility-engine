# AEE Roadmap — beyond Tier 1

## TL;DR

Tier 1 (the naming wedge — alt-text, accessible-name, link-text, heading-structure, form-label) is complete end to end and runs on a local model with no API key. This roadmap takes AEE from "judges five naming concerns" to "an agent can investigate a page, get a graded report with fixes, chat about the findings, and apply remediations." It is six phases (A–F), each leaving a green build and a commit. The next phase is **A: a thin `@aee/engine` orchestrator plus a real `investigate()`**. Key decisions are resolved in the section below — most importantly, the "MCP can't capture" problem is solved with an orchestrator package, not by loosening the evidence-only invariant.

## What it will look like

The payoff of Phase A is that `investigate()` returns a real, multi-concern report instead of an empty stub:

```
AEE · storefront.html                                   local:gemma4:e4b
────────────────────────────────────────────────────────────────────────
 FAIL  alt-text           img#coat       "image"      → "Red wool winter coat"
 FAIL  accessible-name    button#cart    "button"     → "Open cart drawer"
 FAIL  link-text          a#more         "Read more"  → "Read our coat care guide"
 PASS  heading-structure  h1             "Winter coats"
 FAIL  form-label         input#email    (no label)   → "Email address"
────────────────────────────────────────────────────────────────────────
 5 checked · 1 pass · 4 fail · 0 unknown                       release: HOLD
```

The one new dependency edge that makes this possible (and keeps the core invariant intact):

```
   @aee/mcp ───────▶ @aee/engine ──▶ playwright · observers · judges · ai · reporter
   @aee/triage ─────▶ ai · reporter
   @aee/fix ────────▶ core (+ gh)

   @aee/engine is the ONLY package allowed to depend on both a driver and the judges.
   @aee/ai still depends on @aee/core ONLY — "AI sees evidence only" is unchanged.
```

## Context

Tier 1 proved the thesis: AI elevates each check from "is the attribute present?" to "is it correct in context, and here's a better value." But the agent surfaces (`@aee/mcp`, `@aee/triage`) and remediation (`@aee/fix`) are still stubs, and the package graph deliberately keeps `@aee/mcp` off `@aee/playwright` and `@aee/judges`. So "investigate a target" has nowhere to live today: nothing composes capture + judging + reporting. The engine is that composition layer, and it is what every remaining phase builds on.

## Constraints (frozen — see CLAUDE.md)

- AI sees captured evidence only, never the live page: `@aee/ai` depends on `@aee/core` only, enforced by `tests/graph-guard.test.js`. The engine may touch a driver and the judges; the AI layer never does.
- Verdicts never silently upgrade: UNKNOWN and advisory results never become PASS.
- Local-first, no key by default for development (Ollama `gemma4:e4b`); the model is a provider-agnostic seam.
- `node --test` over built `dist/`; browser/local-model tests are gated so CI stays green. Every phase leaves a green build and a commit.
- Plans and docs are clean reflowable markdown, committed in-repo.

## Decisions resolved

- **MCP `investigate` orchestration → an orchestrator package.** Introduce `@aee/engine` exposing `investigate(input) → Report`; it captures, routes each evidence record to its concern's judge, and builds a report. A simple in-process run store (held by the engine, persisted as JSON via the reporter) lets `findings`/`evidence` read past runs. Chosen over a bare evidence store because the surfaces need something to *run* an investigation, not just read one — and the store falls out of the engine for free.
- **Real MCP transport → adopt `@modelcontextprotocol/sdk`** (stdio). It is the standard; rolling our own framing is wasted effort.
- **Agentic fix → pragmatic scope.** `applyFix` turns a suggested fix into a `FixPlan` and, for elements locatable by a stable attribute (id, name) in a known source file, applies a patch and opens a PR via `gh` (dry-run by default). Framework-aware source mapping (JSX/components) is deferred — promising it now would be a workaround, not a fix.
- **Triage UI → a minimal local web app** over `ask()`/`explain()`, no heavy framework, local-first. It is the most owner-opinion-dependent piece, so it is intentionally late and starts as a thin shell to react to.
- **Tiers 2–3 → vision + dynamic capture, last.** Color-alone meaning, focus-indicator visibility, and dynamic announcements need element screenshots (the driver already has `screenshot`/`extractImage`) fed to a vision-capable model, plus interaction capture. This needs a vision model — local vision or Claude — which is flagged as a prerequisite when we get there.

## Work split

### ▶ This session — Phase A: orchestrator + real investigate

- **A1.** Scaffold `@aee/engine` (package.json, tsconfig + project references, deps on core/playwright/observers/judges/ai/reporter).
- **A2.** Implement `investigate(input, opts) → Report`: capture evidence with `@aee/playwright`, group records by `NamingPayload.kind`, route each group to the matching concern/judge through `@aee/ai`, and aggregate into a `Report` via `@aee/reporter`.
- **A3.** Wire `@aee/mcp` `investigate`/`findings`/`explain`/`suggestFix` to the engine + the run store; extend `tests/graph-guard.test.js` (engine is the only driver+judges composer; `@aee/mcp` → `@aee/engine`).
- **A4.** Tests: a gated end-to-end on the local model (investigate the storefront → five verdicts + fixes) and a deterministic engine test with a fixed model.

### ▷ Next sessions

- **Phase B — real MCP transport:** add `@modelcontextprotocol/sdk`, implement `startServer()` over stdio, register the six tools, smoke against an MCP client.
- **Phase C — reporter polish:** multi-concern aggregation, release policy (UNKNOWN/advisory → HOLD), JSON + terminal output.
- **Phase D — agentic fix:** `FixPlan` → patch for locatable elements → `gh` PR, dry-run by default.
- **Phase E — triage UI:** a local "chat with your report" shell over `ask()`.
- **Phase F — Tiers 2–3:** element-screenshot + vision + dynamic capture; color-alone, focus visibility, live-region announcements.

## Reuse

`captureHtml`/`collectEvidence` and the naming observer; all five judges in `@aee/judges`; `createAIClient` + the local model in `@aee/ai`; `buildReport`/`renderTerminalSummary` in `@aee/reporter`; `NAMING_FIXTURES`; and `tests/walking-skeleton*.test.js` as the integration-test template.

## Verification

- Phase A: `pnpm test` green; the gated engine e2e produces a five-row report from a live page on the local model; graph-guard passes with the new engine edge and still forbids `@aee/ai` from reaching a driver.
- Later phases each add their own gated test (transport smoke, fix dry-run patch, etc.).

## Status — resume here

**✅ The entire A–F roadmap is implemented.** A (engine + `investigate()`), B (runnable MCP server + docs), C (reporter), D (targeted FixPlans + `gh` PR scaffold), E (local triage UI shell), F — Tier 2 (color-alone, focus-visible) and Tier 3 (focus management, live regions, keyboard operability). All verified on the local model, except the **Tier 2 vision judging**, which is wired and **gated on a vision model**: it runs the moment you set `AEE_LLM_PROVIDER=local` + `AEE_VISION_MODEL=<a local vision model>` (e.g. `ollama pull llava`), or point it at Claude. The image plumbing and screenshot capture are proven deterministically; `gemma4:e4b` is text-only so the live vision check skips by default.

Possible follow-ons (not required): Tier 4 (wrap axe-core for exact contrast / ARIA validity — the deterministic floor), Tier 5 (advisory-only caption/plain-language checks), a real evidence/artifact store (screenshots by reference rather than inline base64), URL navigation in `investigate`, and richer source-mapping for `applyFix`.
