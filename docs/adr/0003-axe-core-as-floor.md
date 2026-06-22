# ADR 0003 — axe-core is the deterministic floor, not the product

**Status:** Accepted

## Context

Static rule engines (axe-core) are reliable and cheap for deterministic checks — exact contrast ratios, target sizes, ARIA validity, duplicate IDs, attribute presence (Tier 4). AI adds nothing to these and is more expensive and less reliable for them.

## Decision

Wrap **axe-core** as the deterministic **floor** beneath judges. Spend AI on contextual quality (Tiers 1–3) where static rules are blind. A judge may run a `floor()` check and an AI `judge()`; the combined verdict can be "floor passes, AI fails" (e.g. `alt` present but meaningless).

## Consequences

- AEE does not re-implement what axe already does well; it differentiates on the AI quality layer.
- axe-core becomes a dependency of `@aee/judges` (and `@aee/observers` for some grounding), not of `@aee/core`.
- Compliance/WCAG mapping is a downstream lens, not the source of truth.
