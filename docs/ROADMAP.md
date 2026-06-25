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
- **Agent surface** — `@aee/mcp` runs over real `@modelcontextprotocol/sdk` stdio with six tools (investigate, findings, evidence, explain, suggest_fix, apply_fix); `@aee/triage` (`pnpm triage` / `aee-triage`) is a local web app that loads a persisted run and renders it as accessible HTML with a grounded chat.
- **Remediation** — `@aee/fix` turns a suggested fix into a targeted `FixPlan`, applies attribute edits to **HTML or JSX/TSX** source (the latter via a real parse, so a dynamic-expression attribute is declined rather than corrupted), and scaffolds a `gh` PR.
- **Tiers 2–3** — element-screenshot vision (color-alone, focus-visible, text-in-images) on a multimodal local model, plus dynamic capture (focus-management, live-region, keyboard-operable, and network-error — a failed request never announced to assistive tech).
- **Floor + advisory** — Tier 4 via the axe-core floor; Tier 5 caption-accuracy is advisory and can never certify `PASS`.
- **Grounding + integrity** — real DOM and accessibility-tree observers, an opt-in virtual-screen-reader observer, a content-addressed artifact store (screenshots by reference, optionally disk-backed), and runtime schema validation at the observer / AI / judge boundaries.
- **Persistence & DX** — opt-in disk persistence (`AEE_STORE_DIR`) so runs and their artifacts survive across processes (investigate in one MCP session, query findings/evidence/explain in another); a runnable `pnpm demo`; and CI green on every push.

## Future

These items are genuinely large or specialized — documented honestly here rather than half-built:

- **Deeper `apply_fix` source mapping.** `apply_fix` now patches HTML and JSX/TSX — string attributes, located by id or current value, parsed rather than regexed. Still ahead: patching *inside* expressions, rewiring a component's props, multi-file resolution, and mapping a purely structural DOM selector (no stable attribute) back to source — which needs a build-time source map, not just a parse.
- **Real OS screen reader & audio capture** (assessed in [`docs/specs/2026-06-24-os-screen-reader-audio-assessment.md`](specs/2026-06-24-os-screen-reader-audio-assessment.md)). A real OS-level screen reader (VoiceOver / NVDA via `@guidepup/guidepup`, installed) would give the highest-fidelity announcement checks, but driving it takes over the machine (it speaks aloud and captures input), needs OS Accessibility/Automation permissions, and can't run in CI — so it can't be verified here and isn't shipped half-built; the virtual-screen-reader observer is the CI-safe middle ground today. Audio extraction for Tier-5 caption-accuracy needs an ASR pipeline (e.g. Whisper) to transcribe the soundtrack and align it with the captions; until then caption-accuracy stays advisory (never a certified PASS).
- **A richer triage UI.** The triage web app loads a persisted run and offers a grounded chat today. Still ahead: in-UI apply-fix (needs the user's source file), an evidence browser, and multi-run history/navigation.

## Reuse

`captureHtml`/`collectEvidence` and the naming observer; all five judges in `@aee/judges`; `createAIClient` + the local model in `@aee/ai`; `buildReport`/`renderTerminalSummary` in `@aee/reporter`; `NAMING_FIXTURES`; and `tests/walking-skeleton*.test.js` as the integration-test template.

## Verification

- `pnpm test` is green across all packages; the graph-guard enforces every dependency edge — the engine is the only package allowed to reach both a driver and the judges, and `@aee/ai` never reaches a driver or the artifact store.
- Browser, local-model, and vision paths are covered by gated tests that skip only when Chromium or the local model is unavailable; the gated engine end-to-end produces a multi-row report from a live page on the local model.

## Status

**✅ Complete and verified on the local model — no API key.** The A–F roadmap plus the audit-hardening pass (Tier 4 floor, Tier 5 advisory reliability, real DOM/a11y/screen-reader observers, URL navigation, the content-addressed artifact store, and boundary validation) are all implemented. Tier 2 vision runs on `gemma4:e4b`, which is multimodal (`completion, vision, audio, tools, thinking` — confirmed via `ollama show`): `captureVision` screenshots an element and the model judges it; set `AEE_VISION_MODEL` to use a different vision model. Every tier runs on the default local provider; the only skipped tests are the Claude-gated ones. Remaining work is the forward-looking set under **Future**, above.
