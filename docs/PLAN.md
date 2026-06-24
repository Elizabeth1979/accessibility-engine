# Accessibility Evidence Engine (AEE) — Scaffold & Architecture Plan

> **Status:** this is the original scaffold-and-architecture plan; "typed stubs" below describes the M0–M6 *scaffold* deliverable. The framework is now implemented end to end (Tiers 1–3 + vision, the axe floor, advisory Tier 5, the engine, the agent surfaces, remediation, the artifact store, and boundary validation). See [`ROADMAP.md`](ROADMAP.md) for current state; the architecture and contracts below remain accurate.

## TL;DR

- **What:** Create `~/accessibility-engine` — a TypeScript + pnpm-workspace monorepo scaffold for the Accessibility Evidence Engine, an **AI-first** framework that augments existing Playwright tests.
- **The inversion:** axe answers *"is the attribute present?"* (binary, ~30–50% ceiling). AEE answers *"is it correct in this context — and here's a better value."* AI is the spine, grounded strictly in captured evidence so it can't hallucinate.
- **Agent-native:** AEE is operated **by chat through an MCP server** (run investigations, query evidence, apply fixes) — plus **intent declaration** (you tell it a page's purpose), a local **conversational triage UI**, and **agentic remediation** (apply fixes + open PRs).
- **This step ships structure only:** package boundaries, interfaces, JSON schemas, and docs. No accessibility logic — everything is typed stubs.
- **How it's delivered:** 7 verifiable milestones (M0–M6), each leaving a green build. M1 (`@aee/core` contracts) is your architecture-review checkpoint.
- **MVP wedge (next session):** the contextual **naming / alt-text** judge, demoed end-to-end through the MCP server — the agent investigates, explains the failure from evidence, and applies a better `alt`.

## Architecture at a glance

```
  EXISTING PLAYWRIGHT TEST
  +1 import; checkpoint(intent)
        |
        v   @aee/playwright
  +-----------------------------
  | INTERACTION + PAGE STATE
        |
        v   @aee/observers
  +-----------------------------
  | EVIDENCE (grounding)
  |   DOM, a11y, screenshot,
  |   image, styles, announce
        |
  ==== AI SEES EVIDENCE ONLY ====
        |
        v   @aee/ai  (+ intent)
  +-----------------------------
  | JUDGE = axe floor + AI
  |   -> PASS/FAIL/WARN/UNKNOWN
  |   -> suggestedFix
        |
        v   @aee/reporter
  +-----------------------------
  | REPORT + EVIDENCE STORE
  +-----------------------------
        |
   AI-FIRST SURFACES (talk to it)
     @aee/mcp    run/query/fix by chat
     @aee/triage chat with the report
     @aee/fix    apply fix + open PR

  Dependency graph (invariant):
    observers  -> core, axe
    ai         -> core   (evidence only)
    judges     -> core, ai, axe
    reporter   -> core
    playwright -> core, observers
    mcp        -> core, ai, reporter, fix
    triage     -> core, ai, reporter
    fix        -> core           (+ gh)
    core       -> zod
```

## Context

AEE (product name *Accessibility Evidence Engine*; repo folder `accessibility-engine`) augments existing Playwright tests with AI-first accessibility checks. Observers capture grounded evidence per interaction; an AI layer reads that evidence (never the live page) to assess whether a result is *correct in context*, not merely present; judges combine a deterministic axe-core floor with that AI judgment to produce PASS / FAIL / WARN / **UNKNOWN**, each with a suggested fix — never silently upgrading UNKNOWN to PASS.

The differentiator is the inversion of axe: axe starts from a rule and checks presence, capping coverage near 30–50% because the real defects (a meaningless `alt`, an icon button named "button", a heading that doesn't describe its section, meaning carried by color alone) are not statically detectable. AEE judges *quality* against the rendered reality the AI can see — and it is operated **agent-natively**: developers talk to their existing coding agent (via the MCP server), declare intent in plain language, chat with the report, and let it apply fixes.

Positioning, validated by the 2026 landscape (axe-on-top AI agents are now common — Evinced, Test-Lab.ai, TestParty, Siteimprove, axe's own MCP server): the field overpromises, and no tool can certify full compliance. AEE's edge is **trustworthy AI-first** — grounded in reproducible evidence, with reliability tiers and a hard rule that UNKNOWN/advisory results never become PASS.

The spec's closing instruction is explicit: do not implement production code until the architecture is reviewed and approved. So this step creates the project folder and a compiling, principle-enforcing skeleton only — contracts, schemas, docs, typed stubs — no accessibility logic. Greenfield at `~/accessibility-engine` (no collision); kept separate from `~/screen-reader-cli` and SR per prior guidance.

## Coverage map — where AI takes testing toward 100% (and where it can't)

Tiered by what AI actually changes. This drives which judges exist and how each is built.

- **Tier 1 — AI transforms binary checks into quality + fix (the wedge).** Alt text, icon-only button names ("Open clothes drawer", not "button"), link/button text, form-label clarity, heading descriptiveness. *AI authoritative; floor = axe presence.*
- **Tier 2 — AI sees what static rules are blind to.** Meaning by color alone, text baked into images (OCR), contrast over images/gradients, focus-indicator visibility, visual-vs-DOM reading order. *AI unlocks; little static floor.*
- **Tier 3 — AI + runtime evidence (dynamic; axe is blind).** Focus moved sensibly on modal/route change, dynamic change announced *and meaningful*, custom widget genuinely keyboard-operable, error messages actionable. *Needs the evidence engine + AI.*
- **Tier 4 — Keep deterministic; AI adds nothing.** Exact contrast ratios, target-size pixels, ARIA validity, duplicate IDs. *Wrap axe-core; don't spend AI here.*
- **Tier 5 — AI assists but must not certify (advisory only).** Caption accuracy, plain-language adequacy for specific cognitive disabilities, "will a real AT user succeed." *WARN/UNKNOWN + suggestion, never PASS.*

## Stack

- **Language:** TypeScript (ESM, strict). Types ship as part of the framework (`.d.ts`).
- **Monorepo:** pnpm workspaces with TypeScript project references (`tsc -b`, topological build order).
- **Deterministic floor:** `axe-core` wrapped for Tier 4 + presence checks — reused, not re-derived.
- **AI layer:** provider-agnostic (`@aee/ai`); judges quality, explains findings conversationally, and drafts fixes — all grounded in captured evidence. Default model: latest Claude.
- **Agent surface:** `@modelcontextprotocol/sdk` for `@aee/mcp`; `gh` CLI for PR generation in `@aee/fix`. Triage UI is a local web app (local-first); framework TBD (open item).
- **Schemas:** zod is the single source of truth; `zod-to-json-schema` generates `/schemas`.
- **Tests:** `node --test` over built `dist/` — matches `screen-reader-cli` house style, avoids TS type-stripping caveats.
- **Inherited libs:** `@guidepup/virtual-screen-reader`, `@guidepup/guidepup`, `axe-core`, `playwright`, `commander`.
- **Engines & tooling:** node ≥22 (you have 25.5.0), pnpm 11.4.0, git 2.50.1, gh 2.86.0. License MIT.

## Scope & key decisions

- **Scaffold + interfaces + docs only** — honors "design before implementation". Contracts compile; logic is stubbed.
- **AI-first, evidence-grounded** — AI is the primary intelligence (judges quality, converses, drafts fixes) but consumes only captured Evidence Records, never the live page — grounded and reproducible, enforced by `ai → core` only.
- **Agent-native is the primary surface** — MCP server first; the triage UI and CLI are secondary. "Talk to the app" is delivered through the agent you already use.
- **axe-core is the floor, not the product.** AEE's value is the AI quality layer + the conversational/agentic surfaces on top.
- **9 packages + CLI reserved** — the four AI-first surfaces are first-class. Surface packages are thin stubs over `core`/`ai`/`reporter`.
- **Folder `accessibility-engine`; M1 is a stop-and-review checkpoint.**
- **The plan lives in the repo** — this document is committed as `docs/PLAN.md` (linked from the README) so it travels with the code, not only in the local plan file.

## Architecture refinements (the design substance)

Realized as concrete contracts in `@aee/core`; full prose in `docs/architecture.md` + ADRs.

1. **Judge = deterministic floor + AI judgment.** Composes an axe-core floor with an AI quality judgment, yielding a failure mode axe can't express: *rule passes, quality fails* (`alt` present but meaningless).
2. **AI sees evidence only, never the live page.** `@aee/ai` consumes Evidence Records (screenshot, DOM context, a11y node, image bytes, styles). Anti-hallucination + reproducibility, enforced by the dependency graph.
3. **Intent declaration as grounding input.** A first-class `Intent` (purpose / primary action / notes) attaches to a checkpoint, page, or element and is fed to the AI — the difference between suggesting "clothes" and "clothes drawer".
4. **Conversation over evidence.** `@aee/ai` exposes an `explain(question, evidence)` capability returning grounded answers; both `@aee/mcp` and `@aee/triage` are thin front-ends over it (no duplicated chat logic).
5. **Reliability tiers + suggested fixes are first-class.** Every AI judgment carries `reliability: "authoritative" | "advisory"` and an optional `suggestedFix`. Advisory may never produce a confident PASS.
6. **Agentic remediation via FixPlan.** `suggestedFix` becomes a structured `FixPlan` that `@aee/fix` can apply as a safe edit and ship as a PR through `gh`.
7. **Evidence grounding is the observers' job.** DOM, a11y tree, element screenshots, extracted images, computed styles, network, announcements — feeding both the AI and Tier-3 dynamic checks.
8. **Time model + correlation.** `SettleStrategy` (DOM/network/announcement quiescence + timeouts) defines when "after" is captured; `InteractionId` + monotonic `Clock` + `EvidenceWindow` align late events to their cause.
9. **Artifact store by reference; observer failure isolation; Driver seam.** Heavy artifacts are content-addressed `ArtifactRef`s; an observer failure yields no evidence (→ UNKNOWN), never a crash; observers depend on a `Driver` interface (Playwright is the only impl now).

## Developer experience (the product surface)

In the test (Mode A drop-in fixture; Mode B explicit checkpoint with intent):

```ts
import { test, expect } from '@aee/playwright';   // replaces '@playwright/test'

test('checkout flow', async ({ page, aee }) => {
  await page.goto('/checkout');
  await aee.checkpoint('checkout-loaded', {
    intent: { purpose: 'Checkout', primaryAction: 'Pay', notes: 'cart icon opens the cart drawer' },
  });
  // ...existing test unchanged...
});                                                 // evidence collected; report on teardown
```

Then, agent-native, via `@aee/mcp` (the primary AI-first surface):

```
"Investigate the checkout page for accessibility."
"Why did the cart icon button fail?"            -> grounded answer, cites the evidence
"Apply the suggested accessible name and open a PR."
```

- **Report:** machine-readable JSON + a terminal summary, each finding carrying verdict, grounded reason, **suggestedFix**, and reliability tier.
- **Triage UI:** a local "chat with your report" web app over the same evidence + `@aee/ai` conversation layer.

## Repository structure

```
accessibility-engine/
  <root>      package.json, pnpm-workspace.yaml, tsconfig*, .npmrc, LICENSE, README
  packages/   (engine)   core, observers, ai, judges, playwright, reporter
              (surfaces) mcp, triage, fix          (cli reserved)
  schemas/    generated JSON Schema (committed)
  docs/       architecture, coverage-map, observer-lifecycle, plugin-api, mcp-tools, dependency-graph, adr/
  examples/   basic-playwright/
  .github/    workflows/ci.yml
```

### Packages

- **`@aee/core`** — contracts: Evidence, Intent, Judge/Verdict, FixPlan, conversation types, zod schemas, clock, settle/correlation, release policy. Depends on `zod` only.
- **`@aee/observers`** — evidence grounding (DOM, a11y, screenshot, image, styles, network, SR) — stubs. Depends on core, axe-core, virtual-screen-reader.
- **`@aee/ai`** — AI judgment + `explain()` conversation + fix drafting, grounded in evidence — stub. Depends on core only.
- **`@aee/judges`** — per-concern judges = axe floor + AI, tagged Tier 1–5 — stubs → UNKNOWN. Depends on core, ai, axe-core.
- **`@aee/playwright`** — Driver impl + fixture + `checkpoint(intent)` + runner — stubs. Depends on core, observers; peer `@playwright/test`.
- **`@aee/reporter`** — JSON report + terminal summary incl. fixes — stub. Depends on core.
- **`@aee/mcp`** — MCP server exposing investigate / findings / evidence / explain / suggestFix / applyFix — stub. Depends on core, ai, reporter, fix.
- **`@aee/triage`** — local conversational "chat with the report" web UI — stub. Depends on core, ai, reporter.
- **`@aee/fix`** — remediation: FixPlan → safe edit → PR via `gh` — stub. Depends on core.
- **`@aee/cli`** — reserved; deferred (the MCP server is the primary surface).

## Key interfaces (`@aee/core`, real and compiling)

```ts
type Confidence = "high" | "medium" | "low";
type Reliability = "authoritative" | "advisory";
interface Intent { purpose?: string; primaryAction?: string; notes?: string; }     // grounding input
interface Change { path: string; kind: "added"|"removed"|"modified"; before?: unknown; after?: unknown; }

interface EvidenceRecord {
  schemaVersion: string; interactionId: InteractionId; at: ClockTime; observer: string;
  before: unknown; after: unknown; changes: Change[];
  confidence: Confidence; source: "observed" | "derived"; raw?: ArtifactRef;
}

interface AIClient {                                   // sees evidence ONLY
  judge(concern: string, evidence: EvidenceRecord[], intent?: Intent): Promise<AIJudgment>;
  explain(question: string, evidence: EvidenceRecord[]): Promise<GroundedAnswer>;   // conversation
}
interface AIJudgment {
  verdict: "PASS"|"FAIL"|"WARN"|"UNKNOWN"; reliability: Reliability; confidence: Confidence;
  reason: string; suggestedFix?: string; evidenceRefs: InteractionId[];
}

interface Judge { readonly name: string; readonly tier: 1|2|3|4|5;
  floor?(evidence: EvidenceRecord[]): Verdict;                                       // axe-backed
  judge(evidence: EvidenceRecord[], ai: AIClient, ctx: JudgeContext): Promise<Verdict>;
}
interface Verdict {
  status: "PASS"|"FAIL"|"WARN"|"UNKNOWN"; severity?: Severity; confidence: Confidence;
  reason: string; reliability: Reliability; evidenceRefs: InteractionId[]; suggestedFix?: string;
}
interface FixPlan { target: ElementRef; change: Change; suggestedValue: string; rationale: string; evidenceRefs: InteractionId[]; }

interface Driver { /* eval, screenshot, snapshotDom, snapshotA11yTree, extractImage, computedStyle, cdp */ }
interface ReleasePolicy { decide(v: Verdict[]): ReleaseStatus; }   // UNKNOWN/advisory never become PASS
interface Report { schemaVersion: string; summary: ReportSummary; findings: Verdict[]; release: ReleaseStatus; }
```

Interfaces compile; bodies behind `judge`, the AI layer, the driver, and the surfaces are stubs.

## JSON schemas

zod in `@aee/core` is the single source of truth. `pnpm gen:schemas` (via `zod-to-json-schema`) emits `evidence-record`, `ai-judgment`, `verdict`, `fix-plan`, `report` into `/schemas`, each with a `schemaVersion`; validation runs at the observer, AI, and judge boundaries.

## Milestones (modular; each leaves a green build)

- **M0 — Repo foundation.** Folder, `git init`, MIT LICENSE, dotfiles, root manifest (workspaces, scripts), workspace + tsconfig (project refs), CI, README/CONTRIBUTING, `engines.node >=22`, **and this plan committed to the repo as `docs/PLAN.md` (linked from README) as the source of truth for the build**. ✅ `pnpm install` clean; empty `pnpm -r typecheck` passes; `docs/PLAN.md` present.
- **M1 — `@aee/core` contracts (the architecture-approval artifact).** All interfaces above (incl. Intent, FixPlan, conversation), zod schemas, tiers/reliability, `scripts/gen-schemas.ts`. ✅ core builds; `gen:schemas` emits valid JSON Schema validating a fixture. Stop-and-review point.
- **M2 — Evidence substrate.** Driver seam, `@aee/observers` stubs (incl. screenshot/image/a11y grounding), `@aee/playwright` fixture + `checkpoint(intent)` + runner, `examples/basic-playwright`. ✅ example test runs with no-op checkpoints.
- **M3 — `@aee/ai` + `@aee/judges` stubs.** AIClient (judge + explain, stub), per-concern judges as floor+AI stubs tagged Tier 1–5; graph-guard test (asserts `@aee/ai` deps == `{@aee/core}`). ✅ typecheck/build/test green; judges return UNKNOWN.
- **M4 — `@aee/reporter` + release policy.** JSON writer + terminal summary (surfacing fixes + reliability), `ReleasePolicy`, report schema. ✅ empty-but-valid `Report`; UNKNOWN/advisory never PASS.
- **M5 — AI-first surfaces (stubs).** `@aee/mcp` (server registers tools: investigate/findings/evidence/explain/suggestFix/applyFix), `@aee/triage` (local chat UI shell), `@aee/fix` (FixPlan → PR via `gh`, dry-run). ✅ MCP server starts and lists its tools; triage UI builds; fix dry-run prints a plan.
- **M6 — Docs + ADRs.** architecture, coverage-map, observer-lifecycle, plugin-api, mcp-tools, dependency-graph, ADRs (AI-sees-evidence-only, axe-as-floor, judge=floor+AI, agent-native/MCP, TypeScript). ✅ links resolve; mermaid renders. Then the initial commit.

## Verification (end-to-end, after M6)

- `pnpm install` resolves; `pnpm -r build` (`tsc -b`) emits JS + `.d.ts`; `pnpm -r typecheck` passes across all 9 packages.
- `pnpm -r test` (`node --test` over `dist/`) passes — stub judges return UNKNOWN; an assertion proves no judge/advisory result upgrades to PASS.
- `pnpm gen:schemas` writes the 5 JSON Schemas; each validates a sample artifact.
- Graph-guard confirms `@aee/ai` depends only on `@aee/core` (AI cannot reach the live page).
- `@aee/mcp` boots and lists its tool set (stub handlers); `@aee/fix` dry-run emits a FixPlan; the example Playwright test runs with no-op checkpoints.

## Out of scope — immediate next (separate session)

- **Walking skeleton (the wedge, end-to-end AI-first):** make the contextual naming/alt-text judge real (observers capture element screenshot + surrounding text + a11y node; `@aee/ai` judges meaning using declared intent and proposes a better value), then drive it through `@aee/mcp` so the agent can investigate, `explain` the failure from evidence, and `applyFix` as a PR.
- Then expand Tier 1 (icon buttons, links, headings, labels), Tier 2 (color-alone, text-in-images, focus visibility), Tier 3 dynamic checks; flesh out the triage UI.

## Open items (non-blocking; sensible defaults chosen)

- **Triage UI framework** — local web app; pick before building that surface.
- **AI provider default** — latest Claude (your global default).
- **npm scope `@aee/*`** and **License MIT** — confirm before any publish.
