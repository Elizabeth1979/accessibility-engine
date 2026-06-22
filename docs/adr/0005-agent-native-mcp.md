# ADR 0005 — Agent-native (MCP) is the primary surface

**Status:** Accepted

## Context

"AI-first" for a CI/testing tool should not mean a chat-only GUI that throws away determinism and pipeline integration. The 2026 landscape shows accessibility tools becoming AI-first by exposing themselves to the agent the developer already uses (e.g. axe's MCP server).

## Decision

Make `@aee/mcp` the **primary** way to operate AEE: the developer's coding agent runs investigations, queries evidence, explains findings, and applies fixes via MCP tools. A local **conversational triage UI** (`@aee/triage`) and a future CLI are secondary, and the deterministic test/CI path remains first-class. "Talk to the app" is delivered through the agent, not a bespoke chatbot.

## Consequences

- The conversational capability lives once in `@aee/ai.explain()`; MCP and triage are thin front-ends.
- AEE composes with existing agent workflows instead of competing with them.
- The CLI package is deferred (reserved) — the MCP server supersedes most of its early value.
