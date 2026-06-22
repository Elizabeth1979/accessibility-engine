# ADR 0002 — AI sees evidence only, never the live page

**Status:** Accepted

## Context

AEE is AI-first: AI judges contextual quality, explains findings, and drafts fixes. The risk with AI-first tools is hallucination and non-reproducibility. The spec's principle is "AI must never invent evidence."

## Decision

The AI layer (`@aee/ai`) consumes **only** captured `EvidenceRecord`s — screenshots, DOM context, accessibility nodes, image bytes, computed styles. It has **no** access to a `Driver` or the live page. This is enforced structurally: `@aee/ai` depends only on `@aee/core`, and a `tests/graph-guard.test.js` check fails CI if that boundary is broken. Every AI output is tagged `source: "derived"` and cites the evidence it used.

## Consequences

- Findings are reproducible: a verdict is a function of recorded evidence, replayable even though the model step is probabilistic.
- The conversational/agentic surfaces (`@aee/mcp`, `@aee/triage`) inherit the guarantee, since they go through `@aee/ai`.
- Observers must capture enough grounding up front; if evidence is missing, the result is `UNKNOWN`, never a guessed `PASS`.
