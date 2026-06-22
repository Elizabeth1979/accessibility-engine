# ADR 0004 — A judge is a deterministic floor + an AI judgment

**Status:** Accepted

## Context

We need a single, composable unit that expresses both "is the rule met?" and "is the result good in context?", with honest reliability and an actionable fix.

## Decision

Model a **Judge** as `{ tier, floor?(evidence) , judge(evidence, ai, ctx) }` returning a `Verdict { status, severity?, confidence, reliability, reason, evidenceRefs, suggestedFix? }` where `status ∈ PASS | FAIL | WARN | UNKNOWN` and `reliability ∈ authoritative | advisory`. Advisory judgments (Tier 5) may never yield a confident `PASS`. The `ReleasePolicy` decides how `UNKNOWN`/advisory results propagate to release status; it never converts them to `PASS`.

## Consequences

- A new, useful failure mode exists that static tools cannot express: *rule passes, quality fails*.
- Output is actionable (`reason` + `suggestedFix`) and honest (`reliability` + no single score).
- Judges are pure over evidence, so they are trivially testable and reproducible.
