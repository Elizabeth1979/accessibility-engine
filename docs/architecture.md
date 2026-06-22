# Architecture

> Canonical plan: [`PLAN.md`](PLAN.md). This document expands the *why* behind the contracts in `@aee/core`.

## The inversion

axe-style scanners start from a rule and check **presence** (`is there an alt attribute?`). That caps coverage near 30–50% because the defects that matter are about **quality and context**, which are not statically detectable. AEE keeps the deterministic rule as a *floor* and adds an AI layer that judges **correctness in context**, producing a verdict, a grounded reason, a suggested fix, and a reliability tier.

A judge therefore has a failure mode axe cannot express: **rule passes, quality fails** — e.g. `alt` is present (floor `PASS`) but meaningless (AI `FAIL`, with a better value suggested).

## Evidence as the grounding layer

Observers are the only components that touch the live page. Each interaction produces immutable `EvidenceRecord`s — DOM, accessibility tree, element screenshots, extracted image bytes, computed styles, network, screen-reader announcements. Heavy artifacts are stored **by reference** (`ArtifactRef`) so records stay small and diffable.

The AI layer (`@aee/ai`) consumes **only** these records — never the live page. This is the project's central design decision (see [ADR 0002](adr/0002-ai-sees-evidence-only.md)):

- **No hallucination** — the AI reasons over real, captured pixels/DOM/a11y nodes.
- **Reproducible** — a finding is a function of recorded evidence, so it can be replayed and re-verified even though the AI step is probabilistic.
- **Structural, not aspirational** — `@aee/ai → @aee/core` only; there is no import path from AI to a driver.

## The time model (the hard part)

"Observed simultaneously" hides that a DOM mutation, a screen-reader announcement, and a network response arrive hundreds of milliseconds apart. AEE makes time explicit:

- **`SettleStrategy`** defines when "after" is captured: DOM-mutation-idle + network-idle + announcement-queue-drained, each with a timeout.
- **`EvidenceWindow`** + an `InteractionId` + a monotonic `Clock` correlate late events (e.g. an announcement at t≈800ms) back to the interaction that caused them.

## Intent as input

Most AI-first features are about output. **Intent declaration** is AI-first *input*: the developer states a page/element's purpose in plain language (`{ purpose: 'Checkout', primaryAction: 'Pay' }`), and the AI uses it as grounding. It is the difference between suggesting "clothes" and "clothes drawer".

## Surfaces

The engine is operated agent-natively. `@aee/mcp` exposes investigations, evidence queries, explanations, and fixes as MCP tools; `@aee/triage` is a local chat UI; `@aee/fix` turns a `suggestedFix` into a `FixPlan` and a PR. All three are thin front-ends over `@aee/ai` + `@aee/reporter`, so they inherit the evidence-only guarantee.

## Trust posture

The 2026 landscape is full of tools that overpromise. AEE's posture is **trustworthy AI-first**: reliability tiers on every judgment, advisory results that can never become `PASS`, and a report that never collapses to a single score. Automated testing augments — it does not replace — expert and assistive-technology user review.
