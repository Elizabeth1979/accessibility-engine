# AEE Roadmap — beyond Tier 1

## TL;DR

AEE is now complete end to end and verified on a local model with no API key. An agent can investigate a page (HTML or a URL), get a graded multi-concern report with suggested fixes, chat about the findings grounded in evidence, and apply attribute fixes to source. Coverage spans Tier 1 (the naming wedge), Tier 2 vision (color-alone, focus-visible, text-in-images), Tier 3 dynamic (focus-management, live-region, keyboard-operable), the Tier 4 axe-core floor, and Tier 5 advisory (caption-accuracy, never a certified `PASS`). The `@aee/engine` orchestrator composes capture → judge → report; the agent surfaces (`@aee/mcp`, `@aee/triage`) and remediation (`@aee/fix`) are thin front-ends over it. A content-addressed artifact store keeps screenshots out of the evidence, and runtime schema validation guards every boundary — all without loosening the evidence-only invariant. What remains is genuinely forward-looking (see Future, below).

## What it will look like

`investigate()` returns a real, multi-concern report:

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

Tier 1 proved the thesis: AI elevates each check from "is the attribute present?" to "is it correct in context, and here's a better value." The package graph deliberately keeps `@aee/mcp` off `@aee/playwright` and `@aee/judges`, so "investigate a target" needed somewhere to live: a layer that composes capture + judging + reporting without letting a surface reach a driver or the judges. `@aee/engine` is that composition layer, and the agent surfaces and remediation are built on it.

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

## Built

The phased plan (A–F) is fully implemented, and a follow-up hardening pass closed the gaps between this roadmap and the architecture plan:

- **Engine + investigate** — `@aee/engine` captures, routes each evidence record to its concern's judge, composes the deterministic axe floor with AI quality, and returns a stored `Report`. `investigate` accepts HTML or a URL.
- **Agent surface** — `@aee/mcp` runs over real `@modelcontextprotocol/sdk` stdio with six tools (investigate, findings, evidence, explain, suggest_fix, apply_fix); `@aee/triage` is a local "chat with your report" shell.
- **Remediation** — `@aee/fix` turns a suggested fix into a targeted `FixPlan`, applies attribute edits to source, and scaffolds a `gh` PR. Framework-aware source mapping is deferred.
- **Tiers 2–3** — element-screenshot vision (color-alone, focus-visible, text-in-images) on a multimodal local model, plus dynamic capture (focus-management, live-region, keyboard-operable).
- **Floor + advisory** — Tier 4 via the axe-core floor; Tier 5 caption-accuracy is advisory and can never certify `PASS`.
- **Grounding + integrity** — real DOM and accessibility-tree observers, an opt-in virtual-screen-reader observer, a content-addressed artifact store (screenshots by reference, optionally disk-backed), and runtime schema validation at the observer / AI / judge boundaries.
- **Persistence & DX** — opt-in disk persistence (`AEE_STORE_DIR`) so runs and their artifacts survive across processes (investigate in one MCP session, query findings/evidence/explain in another); a runnable `pnpm demo`; and CI green on every push.

## Future

These items are genuinely large or specialized — documented honestly here rather than half-built:

- **Framework-aware source mapping for `apply_fix`.** Today `apply_fix` patches attributes on elements locatable by a stable id/attribute in HTML source. Mapping a rendered-DOM selector back to its origin in JSX/TSX or a component library means parsing the framework's source and tracking the render → DOM relationship — effectively a per-framework adapter. Large, and best driven by a concrete target codebase.
- **Capture AEE doesn't yet have.** Network (CDP request/response correlation) for Tier-3 error and async checks; audio extraction so Tier-5 caption-accuracy can be judged against the soundtrack rather than only flagged advisory; and a real OS-level screen reader (VoiceOver / NVDA via `@guidepup`) for the highest-fidelity announcement checks. Each is its own capture pipeline; the virtual screen reader covers the CI-safe middle ground today.
- **A fuller `@aee/triage` UI.** The local "chat with your report" surface is a thin shell over `@aee/ai.explain`; a real web app (framework, evidence viewer, in-place fix-apply) is a separate front-end effort — intentionally late, as the most design-dependent piece.

## Reuse

`captureHtml`/`collectEvidence` and the naming observer; all five judges in `@aee/judges`; `createAIClient` + the local model in `@aee/ai`; `buildReport`/`renderTerminalSummary` in `@aee/reporter`; `NAMING_FIXTURES`; and `tests/walking-skeleton*.test.js` as the integration-test template.

## Verification

- `pnpm test` is green across all packages; the graph-guard enforces every dependency edge — the engine is the only package allowed to reach both a driver and the judges, and `@aee/ai` never reaches a driver or the artifact store.
- Browser, local-model, and vision paths are covered by gated tests that skip only when Chromium or the local model is unavailable; the gated engine end-to-end produces a multi-row report from a live page on the local model.

## Status

**✅ Complete and verified on the local model — no API key.** The A–F roadmap plus the audit-hardening pass (Tier 4 floor, Tier 5 advisory reliability, real DOM/a11y/screen-reader observers, URL navigation, the content-addressed artifact store, and boundary validation) are all implemented. Tier 2 vision runs on `gemma4:e4b`, which is multimodal (`completion, vision, audio, tools, thinking` — confirmed via `ollama show`): `captureVision` screenshots an element and the model judges it; set `AEE_VISION_MODEL` to use a different vision model. Every tier runs on the default local provider; the only skipped tests are the Claude-gated ones. Remaining work is the forward-looking set under **Future**, above.
