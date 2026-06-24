# Accessibility Evidence Engine — agent guide

AI-first accessibility testing: AI elevates each check from "is the attribute present?" to "is it correct in context, and here's a better value." Implemented end to end across Tiers 1–5 (naming, vision, dynamic, the axe-core floor, advisory) and verified on a local model; the engine, the agent surfaces (MCP, triage), and remediation (fix) are real. See `docs/ROADMAP.md` for current state and what's next, and `docs/PLAN.md` for the architecture.

## Frozen invariants (do not break)

- **AI sees captured evidence only, never the live page.** `@aee/ai` depends on `@aee/core` only. `tests/graph-guard.test.js` enforces this and the other graph edges — keep it green. The only package allowed to depend on both a driver (`@aee/playwright`) and the judges is `@aee/engine`.
- **Verdicts never silently upgrade:** UNKNOWN and advisory results must never become PASS.

## Defaults

- **Local-first, no API key.** The AI layer is provider-agnostic (the `JudgmentModel` seam). For local runs set `AEE_LLM_PROVIDER=local` (Ollama `gemma4:e4b` by default; see README). `claude` and `stub` providers also exist; with no key the default is `stub`, and a local judgment degrades to UNKNOWN if the server is down — never a guessed PASS.
- **Tests:** `pnpm test` runs `node --test` over built `dist/`. Each change leaves a green build. Browser and local-model tests are gated (they skip when a browser / local server is unavailable).
- **Runs are in-memory by default.** Set `AEE_STORE_DIR` to persist runs + their content-addressed artifacts to disk so they survive across processes; the engine still resolves artifact refs before the AI (the evidence-only invariant holds either way).

## Conventions

- TypeScript ESM, NodeNext resolution, `.js` import extensions, `zod` as the single schema source of truth (types via `z.infer`).
- Plans and docs: clean reflowable markdown (no hard-wrapped "bricks", no changelog sections), committed in-repo.
- Commit and push only when asked. The repo has a GitHub remote (`origin` → github.com/Elizabeth1979/accessibility-engine, public); commits land on `main`.
